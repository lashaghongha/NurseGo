using WebPush;
using NurseGo.API.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace NurseGo.API.Services;

public class PushService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<PushService> _logger;

    public PushService(AppDbContext db, IConfiguration config, ILogger<PushService> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    public async Task SendToUser(int userId, string title, string body, string? url = null)
    {
        var subs = await _db.PushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync();

        if (!subs.Any()) return;

        var publicKey  = _config["VAPID_PUBLIC_KEY"]  ?? Environment.GetEnvironmentVariable("VAPID_PUBLIC_KEY")  ?? "";
        var privateKey = _config["VAPID_PRIVATE_KEY"] ?? Environment.GetEnvironmentVariable("VAPID_PRIVATE_KEY") ?? "";
        var subject    = _config["VAPID_SUBJECT"]     ?? Environment.GetEnvironmentVariable("VAPID_SUBJECT")     ?? "mailto:nursego@example.com";

        var vapidDetails = new VapidDetails(subject, publicKey, privateKey);
        var client = new WebPushClient();

        var payload = JsonSerializer.Serialize(new { title, body, url = url ?? "/" });

        var toRemove = new List<Models.PushSubscription>();
        foreach (var sub in subs)
        {
            try
            {
                var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await client.SendNotificationAsync(pushSub, payload, vapidDetails);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone ||
                                               ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                toRemove.Add(sub); // invalid subscription — წავშალოთ
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Push failed for user {UserId}: {Msg}", userId, ex.Message);
            }
        }

        if (toRemove.Any())
        {
            _db.PushSubscriptions.RemoveRange(toRemove);
            await _db.SaveChangesAsync();
        }
    }
}
