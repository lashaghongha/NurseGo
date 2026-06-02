using System.Security.Cryptography;
using System.Text;

namespace NurseGo.API.Services;

// Agora AccessToken2 implementation
// https://docs.agora.io/en/video-calling/reference/access-token-privileges
public class AgoraTokenService
{
    private readonly string _appId;
    private readonly string _appCertificate;

    public AgoraTokenService(IConfiguration config)
    {
        _appId = config["Agora:AppId"] ?? throw new InvalidOperationException("Agora:AppId missing");
        _appCertificate = config["Agora:AppCertificate"] ?? throw new InvalidOperationException("Agora:AppCertificate missing");
    }

    public string GenerateRtcToken(string channelName, uint uid, int expireSeconds = 3600)
    {
        uint issueTs = (uint)DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        uint expireTs = issueTs + (uint)expireSeconds;
        uint salt = (uint)Random.Shared.Next(1, int.MaxValue);

        // Privilege values for RTC token
        // 1 = JoinChannel, 2 = PublishAudioStream, 3 = PublishVideoStream
        var privileges = new Dictionary<ushort, uint>
        {
            { 1, expireTs }, // JoinChannel
            { 2, expireTs }, // PublishAudioStream
            { 3, expireTs }, // PublishVideoStream
        };

        var msg = PackMessage(issueTs, salt, channelName, uid, privileges);
        var sig = GenerateSignature(_appCertificate, _appId, channelName, uid, msg);

        var token = PackToken(sig, msg);
        return "007" + Convert.ToBase64String(Encoding.UTF8.GetBytes(token));
    }

    private static byte[] PackMessage(uint issueTs, uint salt, string channelName, uint uid, Dictionary<ushort, uint> privileges)
    {
        using var ms = new MemoryStream();
        using var bw = new BinaryWriter(ms);
        bw.Write(issueTs);
        bw.Write(salt);

        // pack privileges
        bw.Write((ushort)privileges.Count);
        foreach (var kv in privileges.OrderBy(k => k.Key))
        {
            bw.Write(kv.Key);
            bw.Write(kv.Value);
        }

        // pack channel name
        var channelBytes = Encoding.UTF8.GetBytes(channelName);
        bw.Write((ushort)channelBytes.Length);
        bw.Write(channelBytes);

        // pack uid
        var uidStr = uid == 0 ? "" : uid.ToString();
        var uidBytes = Encoding.UTF8.GetBytes(uidStr);
        bw.Write((ushort)uidBytes.Length);
        bw.Write(uidBytes);

        return ms.ToArray();
    }

    private static string GenerateSignature(string appCert, string appId, string channelName, uint uid, byte[] msg)
    {
        var uidStr = uid == 0 ? "" : uid.ToString();
        var content = appId + channelName + uidStr + Convert.ToBase64String(msg);
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appCert));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(content));
        return BitConverter.ToString(hash).Replace("-", "").ToLower();
    }

    private static string PackToken(string sig, byte[] msg)
    {
        var sigBytes = Encoding.UTF8.GetBytes(sig);
        var msgBase64 = Convert.ToBase64String(msg);
        var msgBytes = Encoding.UTF8.GetBytes(msgBase64);

        using var ms = new MemoryStream();
        using var bw = new BinaryWriter(ms);
        bw.Write((ushort)sigBytes.Length);
        bw.Write(sigBytes);
        bw.Write((ushort)msgBytes.Length);
        bw.Write(msgBytes);

        return Convert.ToBase64String(ms.ToArray());
    }
}
