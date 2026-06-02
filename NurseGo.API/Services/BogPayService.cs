using System.Text;
using System.Text.Json;

namespace NurseGo.API.Services;

public class BogPayService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<BogPayService> _logger;

    private const string BaseUrl = "https://api.bog.ge/payments/v1/";
    private const string TokenUrl = "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token";

    public BogPayService(IConfiguration config, IHttpClientFactory http, ILogger<BogPayService> logger)
    {
        _config = config;
        _http = http;
        _logger = logger;
    }

    // ── OAuth2 Token ──────────────────────────────────────────────────────
    private async Task<string?> GetAccessToken()
    {
        var clientId     = _config["BogPay:ClientId"];
        var clientSecret = _config["BogPay:ClientSecret"];

        if (string.IsNullOrEmpty(clientId)) return null; // dev mode

        var client = _http.CreateClient();
        var body = new FormUrlEncodedContent([
            new("grant_type",    "client_credentials"),
            new("client_id",     clientId),
            new("client_secret", clientSecret ?? ""),
        ]);

        var resp = await client.PostAsync(TokenUrl, body);
        if (!resp.IsSuccessStatusCode) return null;

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("access_token").GetString();
    }

    // ── Create Payment Order ──────────────────────────────────────────────
    public async Task<BogPayResult> CreateOrder(int orderId, decimal amount, string customerEmail)
    {
        var token = await GetAccessToken();
        if (token == null)
        {
            // Dev mode — სიმულაცია
            _logger.LogInformation("[BOGPAY DEV] Order #{OrderId} | {Amount}₾", orderId, amount);
            return new BogPayResult(
                Success: true,
                PaymentId: $"dev-{orderId}-{Guid.NewGuid():N}",
                RedirectUrl: $"http://localhost:3000/payment/success?orderId={orderId}&dev=true",
                IsDev: true
            );
        }

        var client = _http.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var payload = new
        {
            callback_url  = $"{_config["App:BaseUrl"]}/api/payments/callback",
            purchase_units = new[] {
                new {
                    quantity   = "1",
                    unit_price = (double)amount,
                    product_id = $"order-{orderId}",
                    description= $"NurseGo შეკვეთა #{orderId}",
                }
            },
            redirect_urls = new {
                success = $"{_config["App:FrontendUrl"]}/payment/success?orderId={orderId}",
                fail    = $"{_config["App:FrontendUrl"]}/payment/fail?orderId={orderId}",
            },
            buyer = new { full_name = customerEmail, email = customerEmail },
            external_order_id = orderId.ToString(),
        };

        var resp = await client.PostAsync($"{BaseUrl}ecommerce/orders",
            new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));

        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            _logger.LogError("BOG Pay failed: {Err}", err);
            return new BogPayResult(false, null, null, false);
        }

        var result = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var paymentId   = result.GetProperty("id").GetString();
        var redirectUrl = result.GetProperty("redirect_url").GetString();

        return new BogPayResult(true, paymentId, redirectUrl, false);
    }

    // ── Verify Payment ────────────────────────────────────────────────────
    public async Task<bool> VerifyPayment(string paymentId)
    {
        if (paymentId.StartsWith("dev-")) return true; // dev mode

        var token = await GetAccessToken();
        if (token == null) return false;

        var client = _http.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var resp = await client.GetAsync($"{BaseUrl}ecommerce/orders/{paymentId}");
        if (!resp.IsSuccessStatusCode) return false;

        var result = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var status = result.GetProperty("order_status").GetProperty("key").GetString();
        return status == "completed";
    }
}

public record BogPayResult(bool Success, string? PaymentId, string? RedirectUrl, bool IsDev);
