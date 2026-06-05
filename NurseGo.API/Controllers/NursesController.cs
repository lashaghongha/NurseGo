using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Models;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NursesController : ControllerBase
{
    private readonly AppDbContext _db;

    public NursesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? district, [FromQuery] string? status)
    {
        var query = _db.Nurses.Include(n => n.User).AsQueryable();

        if (!string.IsNullOrEmpty(district))
            query = query.Where(n => n.Districts.Contains(district) || n.District == district);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<NurseStatus>(status, true, out var s))
            query = query.Where(n => n.Status == s);
        else
            query = query.Where(n => n.Status == NurseStatus.Active || n.Status == NurseStatus.Busy);

        query = query.OrderByDescending(n => n.IsPremium).ThenByDescending(n => n.Rating);

        var nurses = await query.Select(n => new {
            n.Id, n.District, n.Districts, n.ExperienceYears, n.Status, n.Rating, n.TotalOrders,
            n.Services, n.LicenseNumber, n.IsVerified, n.IsPremium, n.PhotoUrl,
            Name = n.User!.Name,
        }).ToListAsync();

        return Ok(nurses);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var nurse = await _db.Nurses
            .Include(n => n.User)
            .FirstOrDefaultAsync(n => n.Id == id);
        if (nurse == null) return NotFound();
        return Ok(nurse);
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> UpdateStatus(int id, UpdateNurseStatusRequest req)
    {
        var nurse = await _db.Nurses.FindAsync(id);
        if (nurse == null) return NotFound();

        if (Enum.TryParse<NurseStatus>(req.Status, true, out var s))
            nurse.Status = s;

        await _db.SaveChangesAsync();
        return Ok(new { nurse.Status });
    }

    [HttpPut("{id}/districts")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> UpdateDistricts(int id, UpdateNurseDistrictsRequest req)
    {
        var nurse = await _db.Nurses.FindAsync(id);
        if (nurse == null) return NotFound();

        nurse.Districts = req.Districts;
        nurse.District = req.Districts.Split(',').FirstOrDefault()?.Trim() ?? nurse.District;

        await _db.SaveChangesAsync();
        return Ok(new { nurse.Districts, nurse.District });
    }

    [HttpPut("{id}/services")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> UpdateServices(int id, UpdateNurseServicesRequest req)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var nurse = await _db.Nurses.FindAsync(id);
        if (nurse == null) return NotFound();
        if (nurse.UserId != userId) return Forbid();

        nurse.Services = req.Services;
        await _db.SaveChangesAsync();
        return Ok(new { nurse.Services });
    }

    [HttpPut("me/phone")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> UpdatePhone([FromBody] UpdatePhoneRequest req)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.Phone = req.Phone;
        await _db.SaveChangesAsync();
        return Ok(new { phone = user.Phone });
    }

    // POST /api/nurses/me/photo — პროფილის ფოტო
    [HttpPost("me/photo")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> UploadPhoto(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "ფაილი ცარიელია" });

        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var ext = Path.GetExtension(file.FileName).ToLower();
        if (!allowed.Contains(ext))
            return BadRequest(new { message = "მხოლოდ JPG, PNG, WEBP" });
        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "მაქსიმუმ 5MB" });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var nurse = await _db.Nurses.FirstOrDefaultAsync(n => n.UserId == userId);
        if (nurse == null) return NotFound();

        var env = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>();
        var uploads = Path.Combine(env.WebRootPath ?? "wwwroot", "uploads", "photos");
        Directory.CreateDirectory(uploads);
        var fileName = $"nurse-{nurse.Id}-{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploads, fileName);

        await using var stream = System.IO.File.Create(filePath);
        await file.CopyToAsync(stream);

        nurse.PhotoUrl = $"/uploads/photos/{fileName}";
        await _db.SaveChangesAsync();

        return Ok(new { photoUrl = nurse.PhotoUrl });
    }

    // GET /api/nurses/me — მიმდინარე ექთნის პროფილი + სტატისტიკა
    [HttpGet("me")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> GetMe()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var nurse = await _db.Nurses
            .Include(n => n.User)
            .FirstOrDefaultAsync(n => n.UserId == userId);
        if (nurse == null) return NotFound();

        // შემოსავალი
        var completedOrders = await _db.Orders
            .Where(o => o.NurseId == nurse.Id && o.Status == OrderStatus.Completed)
            .ToListAsync();
        var totalEarnings = completedOrders.Sum(o => o.TotalPrice) * 0.8m;

        // ბოლო 5 შეკვეთა
        var recentOrders = await _db.Orders
            .Include(o => o.Service)
            .Include(o => o.Customer)
            .Where(o => o.NurseId == nurse.Id)
            .OrderByDescending(o => o.CreatedAt)
            .Take(5)
            .Select(o => new {
                o.Id, o.Status, o.TotalPrice, o.CreatedAt,
                serviceName  = o.Service!.Name,
                serviceIcon  = o.Service.Icon,
                customerName = o.Customer!.Name,
                district     = o.District,
            })
            .ToListAsync();

        // რეიტინგები
        var ratings = await _db.Ratings
            .Where(r => r.NurseId == nurse.Id)
            .OrderByDescending(r => r.CreatedAt)
            .Take(5)
            .Select(r => new {
                r.Stars, r.Comment, r.CreatedAt,
                orderId = r.OrderId,
            })
            .ToListAsync();

        return Ok(new {
            nurse.Id, nurse.UserId,
            name            = nurse.User!.Name,
            email           = nurse.User.Email,
            phone           = nurse.User.Phone,
            nurse.LicenseNumber,
            nurse.District, nurse.Districts,
            nurse.ExperienceYears,
            nurse.Status, nurse.IsVerified, nurse.IsPremium,
            nurse.Rating, nurse.TotalOrders,
            nurse.Services,
            nurse.CreatedAt,
            nurse.PhotoUrl,
            totalEarnings   = Math.Round(totalEarnings, 2),
            completedCount  = completedOrders.Count,
            recentOrders,
            ratings,
        });
    }

    [HttpPut("{id}/location")]
    [Authorize(Roles = "Nurse")]
    public async Task<IActionResult> UpdateLocation(int id, [FromBody] LocationUpdate req)
    {
        var nurse = await _db.Nurses.FindAsync(id);
        if (nurse == null) return NotFound();
        nurse.Latitude = req.Lat;
        nurse.Longitude = req.Lng;
        await _db.SaveChangesAsync();
        return Ok();
    }
}

public record LocationUpdate(double Lat, double Lng);
