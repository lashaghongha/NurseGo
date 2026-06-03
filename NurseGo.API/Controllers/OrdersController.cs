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
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly PushService _push;

    public OrdersController(AppDbContext db, IHubContext<OrderHub> hub, EmailService email, IServiceScopeFactory scopeFactory, PushService push)
    {
        _db = db;
        _hub = hub;
        _email = email;
        _scopeFactory = scopeFactory;
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

        var distSurcharge = PriceCalculator.GetDistrictSurcharge(req.District);
        var nightSurcharge = PriceCalculator.GetNightSurcharge(service.Price, req.IsNightTime);
        var total = service.Price + distSurcharge + nightSurcharge;

        var order = new Order
        {
            CustomerId = UserId,
            ServiceId = req.ServiceId,
            Address = req.Address,
            District = req.District,
            BasePrice = service.Price,
            DistrictSurcharge = distSurcharge,
            NightSurcharge = nightSurcharge,
            TotalPrice = total,
            Notes = req.Notes ?? "",
            IsNightTime = req.IsNightTime,
            ScheduledTime = req.ScheduledTime,
            Status = OrderStatus.Pending,
            Latitude = req.Latitude,
            Longitude = req.Longitude,
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        // ─── კონკრეტული ექთნის გამოძახება (პირდაპირი) ────────────────────────
        if (req.PreferredNurseId.HasValue)
        {
            var preferred = await _db.Nurses.FindAsync(req.PreferredNurseId.Value);
            if (preferred != null && preferred.Status == NurseStatus.Active && preferred.IsVerified)
            {
                order.NurseId = preferred.Id;
                order.Status  = OrderStatus.Assigned;
                preferred.Status = NurseStatus.Busy;
                await _db.SaveChangesAsync();

                await _hub.Clients.Group($"nurse-{preferred.Id}")
                    .SendAsync("NewOrder", new {
                        orderId = order.Id, service = service.Name,
                        district = order.District, address = order.Address,
                        totalPrice = order.TotalPrice, notes = order.Notes,
                        isOtherDistrict = false, isDirect = true,
                    });

                await _hub.Clients.Group($"order-{order.Id}")
                    .SendAsync("StatusChanged", "Assigned");

                var cust = await _db.Users.FindAsync(UserId);
                if (cust != null)
                    _ = Task.Run(() => _email.SendOrderConfirmation(
                        cust.Email, cust.Name, order.Id, service.Name, order.TotalPrice));

                return Ok(new { order.Id, order.TotalPrice, order.Status, nurseAssigned = true, direct = true });
            }
            // ექთანი Busy/Offline — fallback: ჩვეულებრივ broadcast
        }

        // ─── ნაბიჯი 1: Broadcast იმ უბნის ყველა Active ექთანს ───────────────
        var districtNurses = await _db.Nurses
            .Where(n => n.Status == NurseStatus.Active && n.IsVerified &&
                       (n.Districts.Contains(req.District) || n.District == req.District))
            .ToListAsync();

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
            await _hub.Clients.Group($"nurse-{n.Id}").SendAsync("NewOrder", payload);

        // SignalR — კლიენტს ეცნობება სტატუსი
        await _hub.Clients.Group($"order-{order.Id}")
            .SendAsync("StatusChanged", order.Status.ToString());

        // Email — კლიენტს დასტური
        var customer = await _db.Users.FindAsync(UserId);
        if (customer != null)
            _ = Task.Run(() => _email.SendOrderConfirmation(
                customer.Email, customer.Name, order.Id, service.Name, order.TotalPrice));

        // ─── ნაბიჯი 2: 3 წუთში თუ კიდევ Pending — broadcast სხვა ექთნებსაც ─
        var orderId = order.Id;
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromMinutes(3));
            // ახალი scope-ი საჭიროა DbContext-ისთვის
            using var scope = _scopeFactory.CreateScope();
            var db  = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hub = scope.ServiceProvider.GetRequiredService<IHubContext<OrderHub>>();

            var o = await db.Orders.FindAsync(orderId);
            if (o == null || o.Status != OrderStatus.Pending) return; // უკვე მიღებულია

            var otherNurses = await db.Nurses
                .Where(n => n.Status == NurseStatus.Active && n.IsVerified &&
                            !n.Districts.Contains(o.District) && n.District != o.District)
                .ToListAsync();

            var otherPayload = new {
                orderId    = o.Id,
                service    = service.Name,
                district   = o.District,
                address    = o.Address,
                totalPrice = o.TotalPrice,
                notes      = o.Notes,
                isOtherDistrict = true,
            };

            foreach (var n in otherNurses)
                await hub.Clients.Group($"nurse-{n.Id}").SendAsync("NewOrder", otherPayload);
        });

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

        order.NurseId    = nurse.Id;
        order.Status     = OrderStatus.Assigned;
        nurse.Status     = NurseStatus.Busy;
        await _db.SaveChangesAsync();

        // კლიენტს ვაცნობებთ — ექთანი მოდის!
        await _hub.Clients.Group($"order-{id}")
            .SendAsync("StatusChanged", "Assigned");

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

        var nurseDistricts = (nurse.Districts ?? nurse.District ?? "")
            .Split(',').Select(d => d.Trim()).Where(d => d.Length > 0).ToList();

        // პირველ რიგში — ექთნის საკუთარი უბნები
        var sameDistrict = await _db.Orders
            .Include(o => o.Service)
            .Include(o => o.Customer)
            .Where(o => o.Status == OrderStatus.Pending && o.NurseId == null &&
                        nurseDistricts.Contains(o.District))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

        // მეორე — სხვა უბნები (3 წუთზე მეტი Pending)
        var cutoff = DateTime.UtcNow.AddMinutes(-3);
        var otherDistrict = await _db.Orders
            .Include(o => o.Service)
            .Include(o => o.Customer)
            .Where(o => o.Status == OrderStatus.Pending && o.NurseId == null &&
                        !nurseDistricts.Contains(o.District) &&
                        o.CreatedAt <= cutoff)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

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
    public async Task<IActionResult> UpdateStatus(int id, UpdateOrderStatusRequest req)
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
}
