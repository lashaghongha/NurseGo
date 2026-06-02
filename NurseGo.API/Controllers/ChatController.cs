using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Hubs;
using NurseGo.API.Models;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<OrderHub> _hub;

    public ChatController(AppDbContext db, IHubContext<OrderHub> hub)
    { _db = db; _hub = hub; }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string UserRole => User.FindFirstValue(ClaimTypes.Role) ?? "";

    // GET /api/chat/{orderId}
    [HttpGet("{orderId}")]
    public async Task<IActionResult> GetMessages(int orderId)
    {
        var messages = await _db.ChatMessages
            .Where(m => m.OrderId == orderId)
            .OrderBy(m => m.SentAt)
            .ToListAsync();
        return Ok(messages);
    }

    // POST /api/chat/{orderId}
    [HttpPost("{orderId}")]
    public async Task<IActionResult> Send(int orderId, SendChatMessageRequest req)
    {
        var user = await _db.Users.FindAsync(UserId);
        if (user == null) return Unauthorized();

        var msg = new ChatMessage
        {
            OrderId    = orderId,
            SenderId   = UserId,
            SenderName = user.Name,
            SenderRole = UserRole,
            Text       = req.Text,
        };
        _db.ChatMessages.Add(msg);
        await _db.SaveChangesAsync();

        // SignalR — ორივეს ეცნობება
        await _hub.Clients.Group($"order-{orderId}").SendAsync("NewChatMessage", new
        {
            msg.Id, msg.SenderName, msg.SenderRole, msg.Text,
            sentAt = msg.SentAt,
        });

        return Ok(msg);
    }
}
