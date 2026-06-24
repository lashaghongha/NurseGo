using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Models;
using NurseGo.API.Services;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EmailService _email;
    private readonly AuthService _auth;
    public AdminController(AppDbContext db, EmailService email, AuthService auth) { _db = db; _email = email; _auth = auth; }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalOrders     = await _db.Orders.CountAsync();
        var completedOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Completed);
        var pendingOrders   = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Pending && o.NurseId == null);
        // SQLite doesn't support Sum on decimal — sum doubles then convert back
        var totalRevenue    = (decimal)(await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed)
            .SumAsync(o => (double)o.TotalPrice));
        var platformRevenue = totalRevenue * 0.2m;
        var activeNurses    = await _db.Nurses.CountAsync(n => n.Status == NurseStatus.Active);
        var pendingNurses   = await _db.Nurses.CountAsync(n => !n.IsVerified);
        var totalCustomers  = await _db.Users.CountAsync(u => u.Role == UserRole.Customer);

        // ყველაზე ძველი unassigned შეკვეთის ასაკი (წუთებში)
        var oldestPending = await _db.Orders
            .Where(o => o.Status == OrderStatus.Pending && o.NurseId == null)
            .OrderBy(o => o.CreatedAt)
            .Select(o => (DateTime?)o.CreatedAt)
            .FirstOrDefaultAsync();
        var oldestPendingMinutes = oldestPending.HasValue
            ? (int)(DateTime.UtcNow - oldestPending.Value).TotalMinutes
            : 0;

        return Ok(new
        {
            totalOrders, completedOrders, totalRevenue, platformRevenue,
            activeNurses, pendingNurses, totalCustomers,
            pendingOrders, oldestPendingMinutes
        });
    }

    [HttpGet("nurses")]
    public async Task<IActionResult> GetAllNurses()
    {
        var nurses = await _db.Nurses
            .Include(n => n.User)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        // რეალური შემოსავალი — DB-დან, არა გამოანგარიშება
        var nurseIds = nurses.Select(n => n.Id).ToList();
        // SQLite doesn't support Sum on decimal — fetch raw and aggregate in memory
        var earningsRaw = await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed && o.NurseId.HasValue && nurseIds.Contains(o.NurseId.Value))
            .Select(o => new { o.NurseId, o.TotalPrice })
            .ToListAsync();
        var earningsMap = earningsRaw
            .GroupBy(o => o.NurseId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(o => o.TotalPrice));

        var result = nurses.Select(n => new
        {
            n.Id, n.UserId,
            name          = n.User?.Name,
            email         = n.User?.Email,
            n.LicenseNumber,
            n.District, n.Districts,
            n.ExperienceYears,
            n.Status, n.IsVerified, n.IsPremium,
            n.Rating, n.TotalOrders,
            n.Services, n.CreatedAt,
            n.Latitude, n.Longitude,
            // ✅ რეალური შემოსავალი (ექთნის წილი — 80%)
            realEarnings  = earningsMap.TryGetValue(n.Id, out var e) ? Math.Round(e * 0.8m, 2) : 0,
            user          = n.User,
        });

        return Ok(result);
    }

    [HttpPost("nurses/{id}/verify")]
    public async Task<IActionResult> VerifyNurse(int id)
    {
        var nurse = await _db.Nurses.Include(n => n.User).FirstOrDefaultAsync(n => n.Id == id);
        if (nurse == null) return NotFound();
        nurse.IsVerified = true;
        nurse.Status = NurseStatus.Active;
        await _db.SaveChangesAsync();
        // Email notification
        if (nurse.User != null)
            await _email.SendNurseVerified(nurse.User.Email, nurse.User.Name);
        return Ok();
    }

    [HttpPost("nurses/{id}/block")]
    public async Task<IActionResult> BlockNurse(int id)
    {
        var nurse = await _db.Nurses.FindAsync(id);
        if (nurse == null) return NotFound();
        nurse.Status = NurseStatus.Blocked;
        await _db.SaveChangesAsync();
        return Ok();
    }

    // PUT /api/admin/nurses/{id} — update all nurse info + optional password change
    [HttpPut("nurses/{id}")]
    public async Task<IActionResult> UpdateNurse(int id, AdminUpdateNurseRequest req)
    {
        var nurse = await _db.Nurses.Include(n => n.User).FirstOrDefaultAsync(n => n.Id == id);
        if (nurse == null) return NotFound();

        // Update User fields
        if (nurse.User != null)
        {
            if (!string.IsNullOrWhiteSpace(req.Name))  nurse.User.Name  = req.Name.Trim();
            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                var emailTaken = await _db.Users.AnyAsync(u => u.Email == req.Email && u.Id != nurse.UserId);
                if (emailTaken) return BadRequest(new { message = "ეს მეილი სხვა ანგარიშს ეკუთვნის" });
                nurse.User.Email = req.Email.Trim();
            }
            if (!string.IsNullOrWhiteSpace(req.Phone))  nurse.User.Phone = req.Phone.Trim();
            if (!string.IsNullOrWhiteSpace(req.NewPassword))
                nurse.User.PasswordHash = _auth.HashPassword(req.NewPassword);
        }

        // Update Nurse fields
        if (!string.IsNullOrWhiteSpace(req.LicenseNumber)) nurse.LicenseNumber = req.LicenseNumber.Trim();
        if (!string.IsNullOrWhiteSpace(req.Districts))
        {
            nurse.Districts = req.Districts.Trim();
            nurse.District  = req.Districts.Split(',').FirstOrDefault()?.Trim() ?? nurse.District;
        }
        if (!string.IsNullOrWhiteSpace(req.Services))     nurse.Services        = req.Services.Trim();
        if (req.ExperienceYears.HasValue)                  nurse.ExperienceYears = req.ExperienceYears.Value;
        if (!string.IsNullOrWhiteSpace(req.Status) && Enum.TryParse<NurseStatus>(req.Status, true, out var st))
            nurse.Status = st;
        if (req.IsVerified.HasValue)
        {
            nurse.IsVerified = req.IsVerified.Value;
            if (req.IsVerified.Value && nurse.Status == NurseStatus.Pending)
                nurse.Status = NurseStatus.Active;
        }

        await _db.SaveChangesAsync();
        return Ok(new {
            nurse.Id, nurse.UserId,
            name = nurse.User?.Name, email = nurse.User?.Email, phone = nurse.User?.Phone,
            nurse.LicenseNumber, nurse.Districts, nurse.District,
            nurse.ExperienceYears, nurse.Services,
            nurse.Status, nurse.IsVerified,
        });
    }

    // DELETE /api/admin/nurses/{id} — reject & delete unverified nurse application
    [HttpDelete("nurses/{id}")]
    public async Task<IActionResult> RejectNurse(int id)
    {
        var nurse = await _db.Nurses.Include(n => n.User).FirstOrDefaultAsync(n => n.Id == id);
        if (nurse == null) return NotFound();
        if (nurse.IsVerified) return BadRequest(new { message = "ვერიფიცირებული ექთნის წაშლა არ შეიძლება" });
        // Remove nurse record and associated user account
        if (nurse.User != null) _db.Users.Remove(nurse.User);
        _db.Nurses.Remove(nurse);
        await _db.SaveChangesAsync();
        return Ok(new { message = "განაცხადი უარყოფილია" });
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetAllOrders([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var orders = await _db.Orders
            .Include(o => o.Service)
            .Include(o => o.Customer)
            .Include(o => o.Nurse).ThenInclude(n => n!.User)
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        return Ok(orders);
    }

    // GET /api/admin/nurses/pending — unverified nurses
    [HttpGet("nurses/pending")]
    public async Task<IActionResult> GetPendingNurses()
    {
        var nurses = await _db.Nurses
            .Include(n => n.User)
            .Where(n => !n.IsVerified)
            .OrderBy(n => n.CreatedAt)
            .Select(n => new {
                n.Id, n.UserId,
                name           = n.User!.Name,
                email          = n.User.Email,
                phone          = n.User.Phone,
                n.LicenseNumber,
                n.Districts, n.District,
                n.ExperienceYears,
                n.Services,
                n.Status, n.IsVerified,
                n.CreatedAt,
            })
            .ToListAsync();
        return Ok(nurses);
    }

    // GET /api/admin/orders/pending — unassigned შეკვეთები
    [HttpGet("orders/pending")]
    public async Task<IActionResult> GetPendingOrders()
    {
        var orders = await _db.Orders
            .Include(o => o.Service)
            .Include(o => o.Customer)
            .Where(o => o.Status == OrderStatus.Pending && o.NurseId == null)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();
        return Ok(orders);
    }

    [HttpGet("nurses/{id}/documents")]
    public async Task<IActionResult> GetNurseDocuments(int id)
    {
        var docs = await _db.NurseDocuments.Where(d => d.NurseId == id).ToListAsync();
        return Ok(docs);
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var rawUsers = await _db.Users
            .Where(u => u.Role == UserRole.Customer)
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var userIds = rawUsers.Select(u => u.Id).ToList();
        var orderCounts = await _db.Orders
            .Where(o => userIds.Contains(o.CustomerId))
            .GroupBy(o => o.CustomerId)
            .Select(g => new { CustomerId = g.Key, Count = g.Count() })
            .ToListAsync();
        var countMap = orderCounts.ToDictionary(x => x.CustomerId, x => x.Count);

        var users = rawUsers.Select(u => new
        {
            u.Id, u.Name, u.Email, u.Phone,
            role = u.Role.ToString(),
            u.CreatedAt,
            totalOrders = countMap.TryGetValue(u.Id, out var c) ? c : 0,
        });

        var total = await _db.Users.CountAsync(u => u.Role == UserRole.Customer);
        return Ok(new { users, total });
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        if (user.Role == UserRole.Admin) return BadRequest(new { message = "Admin-ის წაშლა შეუძლებელია" });
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("revenue/monthly")]
    public async Task<IActionResult> GetMonthlyRevenue()
    {
        // SQLite: aggregate in memory to avoid decimal Sum translation issues
        var raw = await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed && o.CompletedAt.HasValue)
            .Select(o => new { o.CompletedAt, o.TotalPrice })
            .ToListAsync();

        var data = raw
            .GroupBy(o => new { o.CompletedAt!.Value.Year, o.CompletedAt.Value.Month })
            .Select(g => new
            {
                Year = g.Key.Year,
                Month = g.Key.Month,
                Revenue = g.Sum(o => o.TotalPrice),
                Orders = g.Count(),
                Commission = g.Sum(o => o.TotalPrice) * 0.2m
            })
            .OrderByDescending(x => x.Year).ThenByDescending(x => x.Month)
            .Take(12)
            .ToList();
        return Ok(data);
    }

}
