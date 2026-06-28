using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Models;
using NurseGo.API.Services;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuthService _auth;
    private readonly EmailService _email;

    public AuthController(AppDbContext db, AuthService auth, EmailService email)
    {
        _db = db; _auth = auth; _email = email;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null || !_auth.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "არასწორი მეილი ან პაროლი" });

        var token = _auth.GenerateToken(user);
        return Ok(new AuthResponse(token, new UserDto(user.Id, user.Name, user.Email, user.Role.ToString())));
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return BadRequest(new { message = "ეს მეილი უკვე რეგისტრირებულია" });

        // SECURITY: Always force Customer role on self-registration.
        // Admin role can only be assigned directly in the database.
        var role = UserRole.Customer;

        var user = new User
        {
            Name = req.Name,
            Email = req.Email,
            PasswordHash = _auth.HashPassword(req.Password),
            Role = role,
            Phone = req.Phone,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = _auth.GenerateToken(user);
        return Ok(new AuthResponse(token, new UserDto(user.Id, user.Name, user.Email, user.Role.ToString())));
    }

    [HttpPost("register-nurse")]
    public async Task<IActionResult> RegisterNurse(RegisterNurseRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return BadRequest(new { message = "ეს მეილი უკვე რეგისტრირებულია" });

        var user = new User
        {
            Name = req.Name,
            Email = req.Email,
            PasswordHash = _auth.HashPassword(req.Password),
            Role = UserRole.Nurse,
            Phone = req.Phone,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // საცხოვრებელი უბანი: ექთნის მიერ არჩეული ან პირველი სამუშაო უბანი
        var homeDistrict = !string.IsNullOrWhiteSpace(req.District)
            ? req.District.Trim()
            : req.Districts.Split(',').FirstOrDefault()?.Trim() ?? "";

        var nurse = new Nurse
        {
            UserId = user.Id,
            LicenseNumber = req.LicenseNumber,
            District = homeDistrict,
            Districts = req.Districts,
            ExperienceYears = req.ExperienceYears,
            Services = req.Services,
            Status = NurseStatus.Pending,
            IsVerified = false,
        };
        _db.Nurses.Add(nurse);
        await _db.SaveChangesAsync();

        var token = _auth.GenerateToken(user);
        return Ok(new AuthResponse(token, new UserDto(user.Id, user.Name, user.Email, "Nurse")));
    }

    // ─── POST /api/auth/forgot-password ─────────────────────────────────────
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        // უსაფრთხოებისთვის ყოველთვის Ok ვაბრუნებთ (არ ვამხელთ email-ს)
        if (user == null) return Ok(new { message = "თუ ეს მეილი დარეგისტრირებულია, კოდი გაიგზავნება" });

        var resetToken = new PasswordResetToken
        {
            Email = req.Email,
            Token = new Random().Next(100000, 999999).ToString(),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        };
        _db.PasswordResetTokens.Add(resetToken);
        await _db.SaveChangesAsync();

        await _email.SendPasswordReset(req.Email, user.Name, resetToken.Token);

        return Ok(new {
            message = "კოდი გაიგზავნა",
            // მხოლოდ development-ში:
            devToken = resetToken.Token
        });
    }

    // ─── POST /api/auth/reset-password ──────────────────────────────────────
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest req)
    {
        var resetToken = await _db.PasswordResetTokens
            .Where(t => t.Email == req.Email && t.Token == req.Token && !t.Used && t.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();

        if (resetToken == null)
            return BadRequest(new { message = "კოდი არასწორია ან ვადა გაუვიდა" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null) return NotFound();

        user.PasswordHash = _auth.HashPassword(req.NewPassword);
        resetToken.Used = true;
        await _db.SaveChangesAsync();

        return Ok(new { message = "პაროლი შეიცვალა!" });
    }
}
