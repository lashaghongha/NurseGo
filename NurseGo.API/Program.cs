using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using NurseGo.API.Data;
using NurseGo.API.Hubs;
using NurseGo.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ─── DB: PostgreSQL (Railway) ან SQLite (local) ───────────────────────────────
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
if (!string.IsNullOrEmpty(databaseUrl))
{
    // Railway PostgreSQL — convert postgresql:// URI to Npgsql connection string
    // Npgsql URI support: postgresql://user:pass@host:port/db
    // Add SSL=disable for Railway internal (postgres.railway.internal) connections
    string npgsqlConnStr;
    try
    {
        var uri = new Uri(databaseUrl.Replace("postgresql://", "https://").Replace("postgres://", "https://"));
        var userInfo = uri.UserInfo.Split(':');
        // Internal Railway hostname: no SSL. Public proxy (rlwy.net etc.): require SSL.
        var isInternal = uri.Host.EndsWith(".railway.internal", StringComparison.OrdinalIgnoreCase);
        var sslMode = isInternal ? "Disable" : "Require";
        npgsqlConnStr = $"Host={uri.Host};Port={(uri.Port > 0 ? uri.Port : 5432)};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={Uri.UnescapeDataString(userInfo.Length > 1 ? userInfo[1] : "")};SSL Mode={sslMode};Trust Server Certificate=true;Timeout=15;Command Timeout=30";
    }
    catch
    {
        // fallback: pass raw URL and hope Npgsql can parse it
        npgsqlConnStr = databaseUrl;
    }
    Console.WriteLine($"[DB] Connecting to PostgreSQL: {new Uri(databaseUrl.Replace("postgresql://", "https://").Replace("postgres://", "https://")).Host}");
    builder.Services.AddDbContext<AppDbContext>(opt =>
        opt.UseNpgsql(npgsqlConnStr));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(opt =>
        opt.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=nursego.db"));
}

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AgoraTokenService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<SmsService>();
builder.Services.AddScoped<BogPayService>();
builder.Services.AddScoped<PushService>();
builder.Services.AddHttpClient();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt => {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]
                    ?? Environment.GetEnvironmentVariable("JWT_KEY")
                    ?? throw new Exception("JWT Key not configured"))),
            ValidateIssuer = true,
            ValidIssuer     = builder.Configuration["Jwt:Issuer"]     ?? Environment.GetEnvironmentVariable("JWT_ISSUER"),
            ValidateAudience = true,
            ValidAudience   = builder.Configuration["Jwt:Audience"]   ?? Environment.GetEnvironmentVariable("JWT_AUDIENCE"),
        };
        // SignalR WebSocket-ს JWT token query string-ით გადაეცემა
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var access = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(access) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = access;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => {
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "NurseGo API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme {
        Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement {{
        new OpenApiSecurityScheme {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        }, Array.Empty<string>()
    }});
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opt => opt.AddPolicy("AllowFrontend", p =>
    p.SetIsOriginAllowed(_ => true)
     .AllowAnyMethod()
     .AllowAnyHeader()
     .AllowCredentials()));

var app = builder.Build();

// ─── DB: EnsureCreated + column migrations (non-fatal — app still starts if DB unreachable) ─
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // ახალი სვეტები — SQLite და PostgreSQL ორივე. IF NOT EXISTS გარანტიას იძლევა
    // რომ განმეორებითი გაშვება შეცდომის გარეშე გაივლის.
    var columnMigrations = db.Database.IsNpgsql()
        ? new[]
        {
            // Nurses table
            "ALTER TABLE \"Nurses\" ADD COLUMN IF NOT EXISTS \"PhotoUrl\" TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE \"Nurses\" ADD COLUMN IF NOT EXISTS \"Districts\" TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE \"Nurses\" ADD COLUMN IF NOT EXISTS \"IsPremium\" BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE \"Nurses\" ADD COLUMN IF NOT EXISTS \"MonthlyFee\" NUMERIC NOT NULL DEFAULT 0",
            "ALTER TABLE \"Nurses\" ADD COLUMN IF NOT EXISTS \"Latitude\" DOUBLE PRECISION NOT NULL DEFAULT 0",
            "ALTER TABLE \"Nurses\" ADD COLUMN IF NOT EXISTS \"Longitude\" DOUBLE PRECISION NOT NULL DEFAULT 0",
            // Orders table
            "ALTER TABLE \"Orders\" ADD COLUMN IF NOT EXISTS \"ConfirmedService\" TEXT",
            "ALTER TABLE \"Orders\" ADD COLUMN IF NOT EXISTS \"ConfirmedPrice\" NUMERIC",
            "ALTER TABLE \"Orders\" ADD COLUMN IF NOT EXISTS \"ConfirmedAt\" TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE \"Orders\" ADD COLUMN IF NOT EXISTS \"Latitude\" DOUBLE PRECISION",
            "ALTER TABLE \"Orders\" ADD COLUMN IF NOT EXISTS \"Longitude\" DOUBLE PRECISION",
            "ALTER TABLE \"Nurses\" ADD COLUMN IF NOT EXISTS \"ManualEarnings\" NUMERIC",
        }
        : new[]
        {
            // SQLite — IF NOT EXISTS unsupported, wrapped in try/catch below
            "ALTER TABLE Nurses ADD COLUMN PhotoUrl TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE Nurses ADD COLUMN Districts TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE Nurses ADD COLUMN IsPremium INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Nurses ADD COLUMN MonthlyFee REAL NOT NULL DEFAULT 0",
            "ALTER TABLE Nurses ADD COLUMN Latitude REAL NOT NULL DEFAULT 0",
            "ALTER TABLE Nurses ADD COLUMN Longitude REAL NOT NULL DEFAULT 0",
            "ALTER TABLE Orders ADD COLUMN ConfirmedService TEXT",
            "ALTER TABLE Orders ADD COLUMN ConfirmedPrice REAL",
            "ALTER TABLE Orders ADD COLUMN ConfirmedAt TEXT",
            "ALTER TABLE Orders ADD COLUMN Latitude REAL",
            "ALTER TABLE Orders ADD COLUMN Longitude REAL",
            "ALTER TABLE Nurses ADD COLUMN ManualEarnings REAL",
        };

    foreach (var sql in columnMigrations)
    {
        try
        {
            db.Database.ExecuteSqlRaw(sql);
            Console.WriteLine($"[MIGRATION OK] {sql[..Math.Min(80, sql.Length)]}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[MIGRATION FAIL] {ex.Message[..Math.Min(150, ex.Message.Length)]}");
            // Retry with lowercase table names
            var sqlLower = sql.Replace("\"Nurses\"", "nurses").Replace("\"Orders\"", "orders");
            if (sqlLower != sql)
            {
                try { db.Database.ExecuteSqlRaw(sqlLower); Console.WriteLine($"[MIGRATION OK lower] {sqlLower[..Math.Min(80, sqlLower.Length)]}"); }
                catch (Exception ex2) { Console.WriteLine($"[MIGRATION FAIL lower] {ex2.Message[..Math.Min(100, ex2.Message.Length)]}"); }
            }
        }
    }

    // ─── DistrictPrices table ────────────────────────────────────────────────
    var districtTableSql = db.Database.IsNpgsql()
        ? "CREATE TABLE IF NOT EXISTS \"DistrictPrices\" (\"Id\" SERIAL PRIMARY KEY, \"Name\" TEXT NOT NULL DEFAULT '', \"Surcharge\" NUMERIC NOT NULL DEFAULT 0)"
        : "CREATE TABLE IF NOT EXISTS DistrictPrices (Id INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT NOT NULL DEFAULT '', Surcharge REAL NOT NULL DEFAULT 0)";
    try { db.Database.ExecuteSqlRaw(districtTableSql); Console.WriteLine("[MIGRATION OK] DistrictPrices table"); }
    catch (Exception ex) {
        Console.WriteLine($"[MIGRATION SKIP DistrictPrices] {ex.Message[..Math.Min(120, ex.Message.Length)]}");
        // Retry lowercase
        try { db.Database.ExecuteSqlRaw(districtTableSql.Replace("\"DistrictPrices\"", "district_prices")); } catch { }
    }

    // ─── Seed: District Prices (all 5 GEL) ──────────────────────────────────
    var allDistricts = new[] { "ვაკე", "საბურთალო", "გლდანი", "დიდუბე", "ნაძალადევი", "ისანი", "სამგორი", "კრწანისი", "დიღომი", "ვარკეთილი" };
    if (!db.DistrictPrices.Any())
    {
        foreach (var d in allDistricts)
            db.DistrictPrices.Add(new NurseGo.API.Models.DistrictPrice { Name = d, Surcharge = 5 });
        db.SaveChanges();
        Console.WriteLine("[SEED] District prices seeded (5 GEL each)");
    }

    // ─── Seed: Admin user (idempotent) ───────────────────────────────────────
    var adminEmail = "admin@citymed.ge";
    if (!db.Users.Any(u => u.Role == NurseGo.API.Models.UserRole.Admin))
    {
        db.Users.Add(new NurseGo.API.Models.User
        {
            Name         = "Admin",
            Email        = adminEmail,
            Phone        = "+995000000000",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin2025!"),
            Role         = NurseGo.API.Models.UserRole.Admin,
            CreatedAt    = DateTime.UtcNow,
        });
        db.SaveChanges();
        Console.WriteLine($"[SEED] Admin user created: {adminEmail}");
    }
}
catch (Exception ex)
{
    // DB initialization failed (e.g., PostgreSQL not reachable yet).
    // Log and continue — the app will still start and serve /health.
    // Requests that need the DB will fail with 500 until DB is available.
    Console.Error.WriteLine($"[WARN] DB initialization failed at startup: {ex.Message}");
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ─── Raw CORS — ყველა response-ზე, მათ შორის 500-ზე ───────────────────────
app.Use(async (context, next) =>
{
    var origin = context.Request.Headers["Origin"].FirstOrDefault();
    if (!string.IsNullOrEmpty(origin))
    {
        context.Response.Headers["Access-Control-Allow-Origin"]      = origin;
        context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        context.Response.Headers["Access-Control-Allow-Methods"]     = "GET,POST,PUT,DELETE,OPTIONS,PATCH";
        context.Response.Headers["Access-Control-Allow-Headers"]     = "Content-Type,Authorization,X-Requested-With,x-signalr-user-agent";
        context.Response.Headers["Access-Control-Max-Age"]           = "86400";
    }
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 204;
        return;
    }
    await next();
});

app.UseCors("AllowFrontend");

// გლობალური exception handler
app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    ctx.Response.StatusCode  = 500;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.WriteAsync("{\"message\":\"სერვერის შეცდომა. სცადე მოგვიანებით.\"}");
}));

app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<OrderHub>("/hubs/orders");

// Railway healthcheck
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.Run();
