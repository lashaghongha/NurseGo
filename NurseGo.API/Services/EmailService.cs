using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace NurseGo.API.Services;

public class EmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        var smtpHost = _config["Email:SmtpHost"];
        if (string.IsNullOrEmpty(smtpHost))
        {
            // Dev mode — console-ში ბეჭდავს
            _logger.LogInformation("[EMAIL DEV] To: {To} | Subject: {Subject}\n{Body}",
                toEmail, subject, htmlBody);
            return;
        }

        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(_config["Email:FromName"] ?? "NurseGo", _config["Email:From"]!));
        msg.To.Add(new MailboxAddress(toName, toEmail));
        msg.Subject = subject;
        msg.Body = new TextPart("html") { Text = htmlBody };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(smtpHost, int.Parse(_config["Email:Port"] ?? "587"), SecureSocketOptions.StartTls);
        await smtp.AuthenticateAsync(_config["Email:User"], _config["Email:Password"]);
        await smtp.SendAsync(msg);
        await smtp.DisconnectAsync(true);
    }

    // ── Templates ──────────────────────────────────────────────────────────

    public Task SendOrderConfirmation(string email, string name, int orderId, string service, decimal price)
        => SendAsync(email, name, $"✅ NurseGo — შეკვეთა #{orderId} მიღებულია",
            $"""
            <div style="font-family:sans-serif;max-width:500px;margin:auto">
              <h2 style="color:#0ea5e9">🏥 NurseGo</h2>
              <p>გამარჯობა, <strong>{name}</strong>!</p>
              <p>შენი შეკვეთა <strong>#{orderId}</strong> მიღებულია.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:8px;background:#f8fafc">მომსახურება</td><td style="padding:8px"><strong>{service}</strong></td></tr>
                <tr><td style="padding:8px;background:#f8fafc">ფასი</td><td style="padding:8px"><strong>{price}₾</strong></td></tr>
              </table>
              <a href="http://localhost:3000/tracking/{orderId}"
                 style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
                შეკვეთის თვალყური →
              </a>
              <p style="color:#64748b;margin-top:24px;font-size:13px">NurseGo — სახლში სამედიცინო მომსახურება</p>
            </div>
            """);

    public Task SendPasswordReset(string email, string name, string code)
        => SendAsync(email, name, "🔑 NurseGo — პაროლის აღდგენა",
            $"""
            <div style="font-family:sans-serif;max-width:500px;margin:auto">
              <h2 style="color:#0ea5e9">🏥 NurseGo</h2>
              <p>გამარჯობა, <strong>{name}</strong>!</p>
              <p>შენი პაროლის აღდგენის კოდია:</p>
              <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#0ea5e9;margin:24px 0;text-align:center">
                {code}
              </div>
              <p style="color:#64748b;font-size:13px">კოდი მოქმედია 1 საათი. თუ შენ არ მოგითხოვია — უგულებელყავი.</p>
            </div>
            """);

    public Task SendNurseVerified(string email, string name)
        => SendAsync(email, name, "✅ NurseGo — ვერიფიკაცია დასრულდა!",
            $"""
            <div style="font-family:sans-serif;max-width:500px;margin:auto">
              <h2 style="color:#0ea5e9">🏥 NurseGo</h2>
              <p>გამარჯობა, <strong>{name}</strong>!</p>
              <p>შენი ანგარიში <strong>დადასტურდა</strong>! ახლა შეგიძლია შეკვეთები მიიღო.</p>
              <a href="http://localhost:3000/nurse/dashboard"
                 style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
                ჩემი პანელი →
              </a>
            </div>
            """);
}
