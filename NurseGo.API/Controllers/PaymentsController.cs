using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Hubs;
using NurseGo.API.Models;
using NurseGo.API.Services;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BogPayService _bogPay;
    private readonly EmailService _email;
    private readonly SmsService _sms;
    private readonly IHubContext<OrderHub> _hub;

    public PaymentsController(AppDbContext db, BogPayService bogPay,
        EmailService email, SmsService sms, IHubContext<OrderHub> hub)
    {
        _db = db; _bogPay = bogPay; _email = email; _sms = sms; _hub = hub;
    }

    // POST /api/payments/create  — კლიენტი ითხოვს გადახდის ლინქს
    [HttpPost("create")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> Create([FromBody] CreatePaymentRequest req)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var order  = await _db.Orders.Include(o => o.Customer).Include(o => o.Service)
            .FirstOrDefaultAsync(o => o.Id == req.OrderId && o.CustomerId == userId);

        if (order == null) return NotFound(new { message = "შეკვეთა ვერ მოიძებნა" });
        if (order.Status == OrderStatus.Cancelled)
            return BadRequest(new { message = "გაუქმებული შეკვეთის გადახდა შეუძლებელია" });

        var result = await _bogPay.CreateOrder(order.Id, order.TotalPrice, order.Customer!.Email);
        if (!result.Success) return StatusCode(500, new { message = "გადახდა ვერ შეიქმნა" });

        // Payment record
        var payment = new Payment {
            OrderId = order.Id,
            BogPaymentId = result.PaymentId!,
            Amount = order.TotalPrice,
            Status = "Pending",
        };
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        return Ok(new { redirectUrl = result.RedirectUrl, paymentId = result.PaymentId, isDev = result.IsDev });
    }

    // GET /api/payments/callback  — BOG-ს callback (webhook)
    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string order_id, [FromQuery] string event_code)
    {
        var orderId = int.Parse(order_id);
        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.OrderId == orderId && p.Status == "Pending");
        if (payment == null) return Ok();

        if (event_code == "completed" || await _bogPay.VerifyPayment(payment.BogPaymentId))
        {
            payment.Status = "Completed";
            payment.PaidAt = DateTime.UtcNow;

            var order = await _db.Orders.Include(o => o.Customer).Include(o => o.Service).FirstOrDefaultAsync(o => o.Id == orderId);
            if (order != null)
            {
                // Email + SMS დადასტურება
                if (order.Customer != null)
                {
                    await _email.SendOrderConfirmation(order.Customer.Email, order.Customer.Name,
                        order.Id, order.Service?.Name ?? "", order.TotalPrice);
                    if (!string.IsNullOrEmpty(order.Customer.Phone))
                        await _sms.SendOrderConfirmed(order.Customer.Phone, order.Id, order.Service?.Name ?? "");
                }
                await _hub.Clients.Group($"order-{orderId}").SendAsync("PaymentCompleted", orderId);
            }
            await _db.SaveChangesAsync();
        }
        else
        {
            payment.Status = "Failed";
            await _db.SaveChangesAsync();
        }

        return Ok();
    }

    // POST /api/payments/verify/{orderId}  — frontend poll for dev mode
    [HttpPost("verify/{orderId}")]
    [Authorize]
    public async Task<IActionResult> VerifyDev(int orderId)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.OrderId == orderId);
        if (payment == null) return NotFound();

        if (payment.BogPaymentId.StartsWith("dev-"))
        {
            payment.Status = "Completed";
            payment.PaidAt = DateTime.UtcNow;

            var order = await _db.Orders.Include(o => o.Customer).Include(o => o.Service)
                .FirstOrDefaultAsync(o => o.Id == orderId);
            if (order?.Customer != null)
            {
                await _email.SendOrderConfirmation(order.Customer.Email, order.Customer.Name,
                    order.Id, order.Service?.Name ?? "", order.TotalPrice);
                if (!string.IsNullOrEmpty(order.Customer.Phone))
                    await _sms.SendOrderConfirmed(order.Customer.Phone, order.Id, order.Service?.Name ?? "");
            }
            await _db.SaveChangesAsync();
            await _hub.Clients.Group($"order-{orderId}").SendAsync("PaymentCompleted", orderId);
        }

        return Ok(new { status = payment.Status, paidAt = payment.PaidAt });
    }

    // GET /api/payments/status/{orderId}
    [HttpGet("status/{orderId}")]
    [Authorize]
    public async Task<IActionResult> Status(int orderId)
    {
        var p = await _db.Payments.FirstOrDefaultAsync(p => p.OrderId == orderId);
        return p == null ? NotFound() : Ok(new { p.Status, p.PaidAt });
    }
}

public record CreatePaymentRequest(int OrderId);
