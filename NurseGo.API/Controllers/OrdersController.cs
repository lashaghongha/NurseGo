using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Hubs;
using NurseGo.API.Models;
using NurseGo.API.Services;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<OrderHub> _hub;
    private readonly EmailService _email;
    private readonly PushService _push;

    public OrdersController(AppDbContext db, IHubContext<OrderHub> hub, EmailService email, PushService push)
    {
        _db = db;
        _hub = hub;
        _email = email;
        _push = push;
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ─── POST /api/orders ────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> Create(CreateOrderRequest req)
    {
        var service = await _db.Services.FindAsync(req.ServiceId);
        if (service == null) return BadRequest(new { message = "მომსახურება ვერ მოიძებნა" });

        // Extra services (multi-service order)
        decimal extraBasePrice = 0;
        var extraNames = new List<string>();
        if (req.ExtraServiceIds is { Length: > 0 })
        {
            var extras = await _db.Services
                .Where(s => req.ExtraServiceIds.Contains(s.Id) && s.IsActive)
                .ToListAsync();
            extraBasePrice = extras.Sum(s => s.Price);
            extraNames = extras.Select(s => s.Name).ToList();
        }

        var allBasePrice   = service.Price + extraBasePrice;
        var districtPrice  = await _db.DistrictPrices.FirstOrDefaultAsync(d => d.Name == req.District);
        var distSurcharge  = districtPrice?.Surcharge ?? PriceCalculator.GetDistrictSurcharge(req.District);
        var nightSurcharge = PriceCalculator.GetNightSurcharge(allBasePrice, req.IsNightTime);
        var total          = allBasePrice + distSurcharge + nightSurcharge;

        var notesPrefix = extraNames.Count > 0
            ? $"[+ {string.Join(", ", extraNames)}] "
            : "";

        var order = new Order
        {
            CustomerId = UserId,
            ServiceId = req.ServiceId,
            Address = req.Address,
            District = req.District,
            BasePrice = allBasePrice,
            DistrictSurcharge = distSurcharge,
            NightSurcharge = nightSurcharge,
            TotalPrice = total,
            Notes = notesPrefix + (req.Notes ?? ""),
            IsNightTime = req.IsNightTime,
            ScheduledTime = req.ScheduledTime,
            Status = OrderStatus.Pending,
            Latitude = req.Latitude,
            Longitude = req.Longitude,
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        // ─── ნაბიჯი 1: Broadcast იმ უბნის ყველა Active ექთანს ───────────────
        // EF-ში Contains() → SQL LIKE '%value%' — ზუსტი შედარება in-memory-ში
        var allActiveNurses = await _db.Nurses
            .Where(n => n.Status == NurseStatus.Active && n.IsVerified)
            .ToListAsync();
        var districtNurses = allActiveNurses
            .Where(n => (n.Districts ?? "").Split(',').Select(d => d.Trim())
                            .Contains(req.District, StringComparer.OrdinalIgnoreCase)
                        || string.Equals(n.District, req.District, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var payload = new {
            orderId    = order.Id,
            service    = service.Name,
            district   = order.District,
            address    = order.Address,
            totalPrice = order.TotalPrice,
            notes      = order.Notes,
            isOtherDistrict = false,
        };

        foreach (var n in districtNurses)
        {
            await _hub.Clients.Group($"nurse-{n.Id}").SendAsync("NewOrder", payload);
            _ = _push.SendToUser(n.UserId, "🔔 ახალი შეკვეთა!", $"{service.Name} — {order.District}", "/nurse/dashboard");
        }

        // SignalR — კლიენტს ეცნობება სტატუსი
        await _hub.Clients.Group($"order-{order.Id}")
            .SendAsync("StatusChanged", order.Status.ToString());

        // Email — კლიენტს დასტური
        var customer = await _db.Users.FindAsync(UserId);
        if (customer != null)
            _ = Task.Run(() => _email.SendOrderConfirmation(
                customer.Email, customer.Name, order.Id, service.Name, order.TotalPrice));

        // ─── ნაბიჯი 2: სხვა უბნის ექთნებსაც ეცნობება დაუყოვნებლივ ──────────
        var otherNurses = allActiveNurses
            .Where(n => !districtNurses.Contains(n))
            .ToList();

        var otherPayload = new {
            orderId    = order.Id,
            service    = service.Name,
            district   = order.District,
            address    = order.Address,
            totalPrice = order.TotalPrice,
            notes      = order.Notes,
            isOtherDistrict = true,
        };

        foreach (var n in otherNurses)
        {
            await _hub.Clients.Group($"nurse-{n.Id}").SendAsync("NewOrder", otherPayload);
        }

        return Ok(new { order.Id, order.TotalPrice, order.Status, nurseAssigned = false });
    }

    // ─── POST /api/orders/{id}/accept ───────────────────────────────────────
    // ექთანი თვითონ იჩემებს Pending შეკვეთას
    [HttpPost("{id}/accept")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> Accept(int id)
    {
        var nurse = await _db.Nurses.FirstOrDefaultAsync(n => n.UserId == UserId);
        if (nurse == null) return NotFound(new { message = "ექთნის პროფილი ვერ მოიძებნა" });

        // Race condition protection — ერთდროულად ორი ექთანი ვერ მიიღებს
        var order = await _db.Orders
            .Include(o => o.Service)
            .FirstOrDefaultAsync(o => o.Id == id && o.Status == OrderStatus.Pending && o.NurseId == null);

        if (order == null)
            return BadRequest(new { message = "შეკვეთა უკვე მიღებულია სხვა ექთნის მიერ" });

        // ─── განრიგის კონფლიქტის შემოწმება ─────────────────────────────────────
        var activeOrders = await _db.Orders
            .Include(o => o.Service)
            .Where(o => o.NurseId == nurse.Id &&
                        (o.Status == OrderStatus.Assigned ||
                         o.Status == OrderStatus.InProgress ||
                         o.Status == OrderStatus.EnRoute))
            .ToListAsync();

        if (activeOrders.Count > 0)
        {
            var orderPendingMinutes = (DateTime.UtcNow - order.CreatedAt).TotalMinutes;

            // თუ შეკვეთა 5+ წუთია ელოდება (სხვამ ვერ აიღო) — ნებისმიერ ექთანს შეუძლია
            if (orderPendingMinutes < 5)
            {
                // შევამოწმოთ კონფლიქტი: არსებული შეკვეთის სავარაუდო დასრულება + 15 წთ ბუფერი
                bool hasConflict = activeOrders.Any(active =>
                {
                    int durationMin = ParseDurationMinutes(active.Service?.DurationEstimate) + 15;
                    var estimatedEnd = active.CreatedAt.AddMinutes(durationMin);
                    return estimatedEnd > DateTime.UtcNow;
                });

                if (hasConflict)
                    return BadRequest(new { message = "თქვენ გაქვთ აქტიური შეკვეთა. შეკვეთებს შორის მინიმუმ 15 წუთიანი დაშორება საჭიროა." });
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        order.NurseId    = nurse.Id;
        order.Status     = OrderStatus.Assigned;
        nurse.Status     = NurseStatus.Busy;
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }

        // კლიენტს ვაცნობებთ — ექთანი მოდის!
        await _hub.Clients.Group($"order-{id}")
            .SendAsync("StatusChanged", "Assigned");

        // Push + Email — კლიენტს შეტყობინება
        _ = _push.SendToUser(order.CustomerId, "NurseGo 👩‍⚕️", "ექთანი მიღებულია — გამოდის თქვენსკენ!", $"/tracking/{id}");
        var cust = await _db.Users.FindAsync(order.CustomerId);
        if (cust != null)
            _ = Task.Run(() => _email.SendOrderConfirmation(
                cust.Email, cust.Name, id, order.Service?.Name ?? "მომსახურება", order.TotalPrice));

        // სხვა ექთნებს ვეუბნებით — შეკვეთა დახურულია
        await _hub.Clients.All
            .SendAsync("OrderTaken", id);

        return Ok(new { orderId = id, nurseId = nurse.Id });
    }

    // ─── GET /api/orders/available ───────────────────────────────────────────
    // ექთნის უბნის Pending შეკვეთები
    [HttpGet("available")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> GetAvailableOrders()
    {
        var nurse = await _db.Nurses.FirstOrDefaultAsync(n => n.UserId == UserId);
        if (nurse == null) return NotFound();

        // Use Districts (multi) if non-empty; fall back to District (home) if Districts is empty or null
        var districtsStr = !string.IsNullOrWhiteSpace(nurse.Districts)
            ? nurse.Districts
            : (nurse.District ?? "");
        var nurseDistricts = districtsStr
            .Split(',').Select(d => d.Trim()).Where(d => d.Length > 0).ToList();

        var allPending = await _db.Orders
            .Include(o => o.Service)
            .Include(o => o.Customer)
            .Where(o => o.Status == OrderStatus.Pending && o.NurseId == null)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        List<Order> sameDistrict;
        List<Order> otherDistrict;

        if (nurseDistricts.Count == 0)
        {
            // ექთნს უბნები არ აქვს დაყენებული — ყველა Pending შეკვეთა ჩანს
            sameDistrict  = allPending;
            otherDistrict = new List<Order>();
        }
        else
        {
            sameDistrict  = allPending
                .Where(o => nurseDistricts.Contains((o.District ?? "").Trim(), StringComparer.OrdinalIgnoreCase))
                .ToList();
            otherDistrict = allPending
                .Where(o => !nurseDistricts.Contains((o.District ?? "").Trim(), StringComparer.OrdinalIgnoreCase))
                .ToList();
        }

        return Ok(new {
            sameDistrict,
            otherDistrict,
        });
    }

    // ─── GET /api/orders/my ──────────────────────────────────────────────────
    [HttpGet("my")]
    public async Task<IActionResult> GetMyOrders()
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        IQueryable<Order> query;

        if (role == "Customer")
            query = _db.Orders.Where(o => o.CustomerId == UserId);
        else if (role == "Nurse")
        {
            var nurse = await _db.Nurses.FirstOrDefaultAsync(n => n.UserId == UserId);
            if (nurse == null) return NotFound();
            query = _db.Orders.Where(o => o.NurseId == nurse.Id);
        }
        else
            query = _db.Orders;

        var orders = await query
            .Include(o => o.Service)
            .Include(o => o.Nurse).ThenInclude(n => n!.User)
            .Include(o => o.Customer)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return Ok(orders);
    }

    // ─── GET /api/orders/{id} ────────────────────────────────────────────────
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var order = await _db.Orders
            .Include(o => o.Service)
            .Include(o => o.Nurse).ThenInclude(n => n!.User)
            .Include(o => o.Customer)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();
        return Ok(order);
    }

    // ─── PUT /api/orders/{id}/status ─────────────────────────────────────────
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Nurse,Admin")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateOrderStatusRequest req)
    {
        var order = await _db.Orders.Include(o => o.Nurse).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        if (Enum.TryParse<OrderStatus>(req.Status, true, out var s))
        {
            order.Status = s;
            if (s == OrderStatus.Completed)
            {
                order.CompletedAt = DateTime.UtcNow;
                // ექთნის სტატუსი Active-ზე დაბრუნება
                if (order.Nurse != null)
                {
                    order.Nurse.Status = NurseStatus.Active;
                    order.Nurse.TotalOrders += 1;
                }
            }
        }

        await _db.SaveChangesAsync();

        // SignalR — კლიენტს ეცნობება სტატუსი
        await _hub.Clients.Group($"order-{id}")
            .SendAsync("StatusChanged", order.Status.ToString());

        // Browser Push — შეტყობინება კლიენტს
        var statusMessages = new Dictionary<string, (string title, string body)>
        {
            ["Assigned"]   = ("NurseGo 👩‍⚕️", "ექთანი დაინიშნა თქვენს შეკვეთაზე"),
            ["EnRoute"]    = ("NurseGo 🚗", "ექთანი გამოემართა თქვენსკენ"),
            ["Arrived"]    = ("NurseGo 🏠", "ექთანი თქვენთან მოვიდა"),
            ["InProgress"] = ("NurseGo 💉", "მომსახურება დაიწყო"),
            ["Completed"]  = ("NurseGo ✅", "მომსახურება წარმატებით დასრულდა!"),
            ["Cancelled"]  = ("NurseGo ❌", "შეკვეთა გაუქმდა"),
        };
        if (statusMessages.TryGetValue(order.Status.ToString(), out var msg))
        {
            _ = _push.SendToUser(order.CustomerId, msg.title, msg.body, $"/tracking/{id}");
        }

        return Ok(new { order.Status });
    }

    // ─── POST /api/orders/{id}/cancel ────────────────────────────────────────
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancelOrderRequest req)
    {
        var order = await _db.Orders.Include(o => o.Nurse).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role == "Customer" && order.CustomerId != UserId)
            return Forbid();

        if (order.Status == OrderStatus.Completed || order.Status == OrderStatus.Cancelled)
            return BadRequest(new { message = "ეს შეკვეთა ვეღარ გაუქმდება" });

        // ─── გაუქმების პოლიტიკა ─────────────────────────────────────────────
        // InProgress — გაუქმება სულ არ შეიძლება
        if (order.Status == OrderStatus.InProgress)
            return BadRequest(new { message = "მომსახურება მიმდინარეობს — გაუქმება შეუძლებელია" });

        // Arrived — გაუქმება შეიძლება, მაგრამ გასამგზავრებლი ფასის (20%) ჯარიმა
        decimal cancellationFee = 0;
        string feeNote = "";
        if (role == "Customer" && order.Status == OrderStatus.Arrived)
        {
            cancellationFee = Math.Round(order.TotalPrice * 0.2m, 2);
            feeNote = $" [ჯარიმა: {cancellationFee}₾ — ექთანი უკვე ადგილზეა]";
        }
        // Assigned / EnRoute — გაუქმება შეიძლება, მაგრამ გაფრთხილება (0 ჯარიმა)
        // Pending — თავისუფალი გაუქმება
        // ────────────────────────────────────────────────────────────────────

        order.Status = OrderStatus.Cancelled;
        order.Notes += $" [გაუქმდა: {req.Reason ?? "მიზეზი არ მითითებულა"}]{feeNote}";

        // ექთნის სტატუსი ისევ Active
        if (order.Nurse != null)
            order.Nurse.Status = NurseStatus.Active;

        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"order-{id}")
            .SendAsync("StatusChanged", "Cancelled");

        if (order.NurseId != null)
            await _hub.Clients.Group($"nurse-{order.NurseId}")
                .SendAsync("OrderCancelled", id);

        var responseMsg = cancellationFee > 0
            ? $"შეკვეთა გაუქმდა. ჯარიმა: {cancellationFee}₾"
            : "შეკვეთა გაუქმდა";
        return Ok(new { message = responseMsg, cancellationFee });
    }

    // ─── PUT /api/orders/{id}/assign/{nurseId} ───────────────────────────────
    [HttpPut("{id}/assign/{nurseId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AssignNurse(int id, int nurseId)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();
        order.NurseId = nurseId;
        order.Status = OrderStatus.Assigned;
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"nurse-{nurseId}")
            .SendAsync("NewOrder", new { orderId = id });
        await _hub.Clients.Group($"order-{id}")
            .SendAsync("StatusChanged", "Assigned");

        return Ok();
    }

    // ─── POST /api/orders/{id}/confirm-receipt ───────────────────────────────
    [HttpPost("{id}/confirm-receipt")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> ConfirmReceipt(int id, [FromBody] ConfirmReceiptRequest req)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();
        if (order.CustomerId != UserId) return Forbid();
        if (order.Status != OrderStatus.Completed)
            return BadRequest(new { message = "მხოლოდ დასრულებულ შეკვეთაზეა შესაძლებელი" });

        order.ConfirmedService = req.ServiceName;
        order.ConfirmedPrice   = req.PricePaid;
        order.ConfirmedAt      = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "დადასტურება შენახულია!" });
    }

    // ─── POST /api/orders/{id}/rate ──────────────────────────────────────────
    [HttpPost("{id}/rate")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> RateOrder(int id, [FromBody] RateOrderRequest req)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();
        if (order.CustomerId != UserId) return Forbid();
        if (order.Status != OrderStatus.Completed)
            return BadRequest(new { message = "შეფასება მხოლოდ დასრულებულ შეკვეთაზეა შესაძლებელი" });
        if (await _db.Ratings.AnyAsync(r => r.OrderId == id))
            return BadRequest(new { message = "ეს შეკვეთა უკვე შეფასებულია" });

        var rating = new Rating
        {
            OrderId    = id,
            NurseId    = order.NurseId!.Value,
            CustomerId = UserId,
            Stars      = Math.Clamp(req.Stars, 1, 5),
            Comment    = req.Comment ?? "",
        };
        _db.Ratings.Add(rating);

        // ექთნის საშუალო რეიტინგის განახლება
        var nurse = await _db.Nurses.FindAsync(order.NurseId!.Value);
        if (nurse != null)
        {
            var allRatings = await _db.Ratings
                .Where(r => r.NurseId == nurse.Id)
                .Select(r => r.Stars)
                .ToListAsync();
            allRatings.Add(req.Stars);
            nurse.Rating = Math.Round(allRatings.Average(), 1);
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "შეფასება დამახსოვრდა!" });
    }

    // ─── GET /api/orders/{id}/rating ─────────────────────────────────────────
    [HttpGet("{id}/rating")]
    [Authorize]
    public async Task<IActionResult> GetRating(int id)
    {
        var rating = await _db.Ratings.FirstOrDefaultAsync(r => r.OrderId == id);
        if (rating == null) return Ok(null);
        return Ok(new { rating.Stars, rating.Comment, rating.CreatedAt });
    }

    // ─── Helper: parse "30 წთ" / "1 სთ" → minutes ───────────────────────────
    private static int ParseDurationMinutes(string? estimate)
    {
        if (string.IsNullOrWhiteSpace(estimate)) return 60; // default 60 min
        var lower = estimate.ToLower();
        // სთ / hour
        if (lower.Contains("სთ") || lower.Contains("hour") || lower.Contains("hr"))
        {
            var num = new string(lower.Where(c => char.IsDigit(c) || c == '.').ToArray());
            if (double.TryParse(num, out var h)) return (int)(h * 60);
            return 60;
        }
        // წთ / min
        var digits = new string(lower.Where(char.IsDigit).ToArray());
        if (int.TryParse(digits, out var m)) return m;
        return 60;
    }
}
