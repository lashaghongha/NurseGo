namespace NurseGo.API.Models;

public enum NurseStatus { Active, Busy, Vacation, Offline, Pending, Blocked }
public enum OrderStatus { Pending, Confirmed, Assigned, EnRoute, Arrived, InProgress, Completed, Cancelled }
public enum UserRole { Customer, Nurse, Admin }

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.Customer;
    public string Phone { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Nurse
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string LicenseNumber { get; set; } = "";
    public string District { get; set; } = "";   // პირველი/მთავარი უბანი
    public string Districts { get; set; } = ""; // ყველა უბანი, მძიმით: "ვაკე,საბურთალო"
    public int ExperienceYears { get; set; }
    public NurseStatus Status { get; set; } = NurseStatus.Pending;
    public bool IsVerified { get; set; } = false;
    public double Rating { get; set; } = 0;
    public int TotalOrders { get; set; } = 0;
    public string Services { get; set; } = ""; // comma-separated
    public bool IsPremium { get; set; } = false;
    public decimal MonthlyFee { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string PhotoUrl { get; set; } = "";
}

public class Service
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Icon { get; set; } = "";
    public decimal Price { get; set; }
    public string Category { get; set; } = "";
    public string DurationEstimate { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public class Order
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public User? Customer { get; set; }
    public int? NurseId { get; set; }
    public Nurse? Nurse { get; set; }
    public int ServiceId { get; set; }
    public Service? Service { get; set; }
    public string Address { get; set; } = "";
    public string District { get; set; } = "";
    public decimal BasePrice { get; set; }
    public decimal DistrictSurcharge { get; set; }
    public decimal NightSurcharge { get; set; }
    public decimal TotalPrice { get; set; }
    public string Notes { get; set; } = "";
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public DateTime? ScheduledTime { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public bool IsNightTime { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    public string BogPaymentId { get; set; } = "";
    public decimal Amount { get; set; }
    public string Status { get; set; } = "Pending"; // Pending | Completed | Failed
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}

public class NurseDocument
{
    public int Id { get; set; }
    public int NurseId { get; set; }
    public Nurse? Nurse { get; set; }
    public string FileName { get; set; } = "";
    public string FilePath { get; set; } = "";
    public string DocType { get; set; } = ""; // License | CV | IdCard
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class ChatMessage
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int SenderId { get; set; }
    public string SenderName { get; set; } = "";
    public string SenderRole { get; set; } = ""; // Customer | Nurse
    public string Text { get; set; } = "";
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}

public class PasswordResetToken
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string Token { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public bool Used { get; set; } = false;
}

public class Rating
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    public int NurseId { get; set; }
    public Nurse? Nurse { get; set; }
    public int CustomerId { get; set; }
    public int Stars { get; set; } // 1-5
    public string Comment { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// DTOs
public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Name, string Email, string Password, string Role, string Phone = "");
public record RegisterNurseRequest(string Name, string Email, string Password, string Phone,
    string LicenseNumber, string Districts, int ExperienceYears, string Services);
public record UpdateNurseDistrictsRequest(string Districts);
public record UpdateNurseServicesRequest(string Services);
public record UpdatePhoneRequest(string Phone);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
public record CancelOrderRequest(string? Reason);
public record SendChatMessageRequest(string Text);
public record RejectOrderRequest(string? Reason);
public record CreateOrderRequest(int ServiceId, string Address, string District,
    bool IsNightTime, string? Notes, DateTime? ScheduledTime,
    double? Latitude = null, double? Longitude = null, int? PreferredNurseId = null);
public record UpdateNurseStatusRequest(string Status);
public record UpdateOrderStatusRequest(string Status);
public record SubmitRatingRequest(int OrderId, int NurseId, int Stars, string Comment);
public record UpdateServicePriceRequest(decimal Price);
public record AuthResponse(string Token, UserDto User);
public record UserDto(int Id, string Name, string Email, string Role);
