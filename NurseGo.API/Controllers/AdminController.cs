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
    public AdminController(AppDbContext db, EmailService email) { _db = db; _email = email; }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalOrders     = await _db.Orders.CountAsync();
        var completedOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Completed);
        var pendingOrders   = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Pending && o.NurseId == null);
        var totalRevenue    = await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed)
            .SumAsync(o => o.TotalPrice);
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
        var earnings = await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed && o.NurseId.HasValue && nurseIds.Contains(o.NurseId.Value))
            .GroupBy(o => o.NurseId!.Value)
            .Select(g => new { NurseId = g.Key, Total = g.Sum(o => o.TotalPrice) })
            .ToListAsync();

        var earningsMap = earnings.ToDictionary(e => e.NurseId, e => e.Total);

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
        var data = await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed && o.CompletedAt.HasValue)
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
            .ToListAsync();
        return Ok(data);
    }

}
