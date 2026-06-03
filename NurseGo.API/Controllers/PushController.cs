using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Models;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PushController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public PushController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    // GET /api/push/vapid-public-key
    [HttpGet("vapid-public-key")]
    public IActionResult GetPublicKey()
    {
        var key = _config["VAPID_PUBLIC_KEY"] ?? Environment.GetEnvironmentVariable("VAPID_PUBLIC_KEY") ?? "";
        return Ok(new { publicKey = key });
    }

    // POST /api/push/subscribe
    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe(PushSubscribeRequest req)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // existing subscription-ს განახლება ან ახლის შექმნა
        var existing = await _db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == req.Endpoint);

        if (existing != null)
        {
            existing.P256dh = req.P256dh;
            existing.Auth   = req.Auth;
        }
        else
        {
            _db.PushSubscriptions.Add(new PushSubscription
            {
                UserId   = userId,
                Endpoint = req.Endpoint,
                P256dh   = req.P256dh,
                Auth     = req.Auth,
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "გამოწერა დამახსოვრდა" });
    }

    // DELETE /api/push/unsubscribe
    [HttpDelete("unsubscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var subs = await _db.PushSubscriptions.Where(s => s.UserId == userId).ToListAsync();
        _db.PushSubscriptions.RemoveRange(subs);
        await _db.SaveChangesAsync();
        return Ok();
    }
}
