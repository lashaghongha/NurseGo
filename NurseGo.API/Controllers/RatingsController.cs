using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Models;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RatingsController : ControllerBase
{
    private readonly AppDbContext _db;
    public RatingsController(AppDbContext db) => _db = db;

    // POST /api/ratings
    [HttpPost]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> Submit(SubmitRatingRequest req)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (await _db.Ratings.AnyAsync(r => r.OrderId == req.OrderId))
            return BadRequest(new { message = "ეს შეკვეთა უკვე შეფასებულია" });

        var rating = new Rating
        {
            OrderId    = req.OrderId,
            NurseId    = req.NurseId,
            CustomerId = userId,
            Stars      = Math.Clamp(req.Stars, 1, 5),
            Comment    = req.Comment,
        };
        _db.Ratings.Add(rating);

        var nurse = await _db.Nurses.FindAsync(req.NurseId);
        if (nurse != null)
        {
            var allStars = await _db.Ratings.Where(r => r.NurseId == req.NurseId).Select(r => r.Stars).ToListAsync();
            allStars.Add(req.Stars);
            nurse.Rating = allStars.Average();
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "შეფასება გამოგზავნილია" });
    }

    // GET /api/ratings/order/{orderId}  — has this order been rated?
    [HttpGet("order/{orderId}")]
    [Authorize]
    public async Task<IActionResult> GetForOrder(int orderId)
    {
        var rated = await _db.Ratings.AnyAsync(r => r.OrderId == orderId);
        return Ok(new { rated });
    }

    // GET /api/ratings  (Admin)
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll([FromQuery] int? nurseId)
    {
        var q = _db.Ratings
            .Include(r => r.Nurse).ThenInclude(n => n!.User)
            .Include(r => r.Order).ThenInclude(o => o!.Customer)
            .AsQueryable();

        if (nurseId.HasValue) q = q.Where(r => r.NurseId == nurseId);

        var ratings = await q.OrderByDescending(r => r.CreatedAt)
            .Select(r => new {
                r.Id, r.Stars, r.Comment, r.CreatedAt,
                nurseName    = r.Nurse!.User!.Name,
                customerName = r.Order!.Customer!.Name,
                orderId      = r.OrderId,
            }).ToListAsync();

        return Ok(ratings);
    }
}
