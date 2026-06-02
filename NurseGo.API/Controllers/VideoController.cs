using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NurseGo.API.Services;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VideoController : ControllerBase
{
    private readonly AgoraTokenService _agora;
    private readonly IConfiguration _config;

    public VideoController(AgoraTokenService agora, IConfiguration config)
    {
        _agora = agora;
        _config = config;
    }

    /// <summary>
    /// მიიღე Agora RTC Token ვიდეო ზარისთვის.
    /// channelName = "consult-{orderId}" ან "consult-{nurseId}-{customerId}"
    /// </summary>
    [HttpGet("token")]
    public IActionResult GetToken([FromQuery] string channel, [FromQuery] uint uid = 0)
    {
        if (string.IsNullOrWhiteSpace(channel))
            return BadRequest(new { message = "channel სავალდებულოა" });

        var token = _agora.GenerateRtcToken(channel, uid);

        return Ok(new
        {
            token,
            channel,
            uid,
            appId = _config["Agora:AppId"],
            expiresIn = 3600
        });
    }

    /// <summary>
    /// შექმენი კონსულტაციის ოთახი — unique channel name-ით
    /// </summary>
    [HttpPost("room")]
    public IActionResult CreateRoom([FromBody] CreateRoomRequest req)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var channelName = $"consult-{req.NurseId}-{userId}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        var customerToken = _agora.GenerateRtcToken(channelName, uint.Parse(userId!));
        var nurseToken = _agora.GenerateRtcToken(channelName, (uint)req.NurseId);

        return Ok(new
        {
            channelName,
            appId = _config["Agora:AppId"],
            customerToken,
            nurseToken,
            expiresIn = 3600
        });
    }
}

public record CreateRoomRequest(int NurseId);
