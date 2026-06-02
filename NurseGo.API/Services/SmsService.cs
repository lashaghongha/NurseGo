namespace NurseGo.API.Services;

public class SmsService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<SmsService> _logger;

    public SmsService(IConfiguration config, IHttpClientFactory http, ILogger<SmsService> logger)
    {
        _config = config;
        _http = http;
        _logger = logger;
    }

    public async Task SendAsync(string phone, string message)
    {
        var apiKey = _config["Sms:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogInformation("[SMS DEV] To: {Phone} | {Message}", phone, message);
            return;
        }

        // SMS.ge API (საქართველო)
        var client = _http.CreateClient();
        var url = $"https://smsoffice.ge/api/v2/send/?key={apiKey}&destination={phone}&sender=NurseGo&content={Uri.EscapeDataString(message)}&urgent=true";

        try
        {
            var resp = await client.GetAsync(url);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("SMS failed for {Phone}", phone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMS error for {Phone}", phone);
        }
    }

    public Task SendOrderConfirmed(string phone, int orderId, string service)
        => SendAsync(phone, $"NurseGo: შეკვეთა #{orderId} ({service}) მიღებულია. თვალყური: nursego.ge/tracking/{orderId}");

    public Task SendNurseAssigned(string phone, string nurseName, int orderId)
        => SendAsync(phone, $"NurseGo: ექთანი {nurseName} მოდის შეკვეთა #{orderId}-ზე. NurseGo.ge");

    public Task SendOtp(string phone, string code)
        => SendAsync(phone, $"NurseGo: შენი კოდია {code}. მოქმედია 10 წუთი.");
}
