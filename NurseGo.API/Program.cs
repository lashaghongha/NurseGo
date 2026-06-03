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
    // Railway PostgreSQL — DATABASE_URL format: postgresql://user:pass@host:port/db
    builder.Services.AddDbContext<AppDbContext>(opt =>
        opt.UseNpgsql(databaseUrl));
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
builder.Services.AddControllers();
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

// ─── CORS: local + Vercel ─────────────────────────────────────────────────────
var allowedOrigins = new List<string> { "http://localhost:3000" };
var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL");
if (!string.IsNullOrEmpty(frontendUrl))
    allowedOrigins.Add(frontendUrl);

builder.Services.AddCors(opt => opt.AddPolicy("AllowFrontend", p =>
    p.WithOrigins(allowedOrigins.ToArray())
     .AllowAnyMethod()
     .AllowAnyHeader()
     .AllowCredentials()));

var app = builder.Build();

// ─── DB: EnsureCreated + column migrations ───────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // SQLite-ში ახალი სვეტები (PostgreSQL-ში EnsureCreated მოიცავს მათ)
    if (db.Database.IsSqlite())
    {
        var columnMigrations = new[]
        {
            "ALTER TABLE Nurses ADD COLUMN PhotoUrl TEXT NOT NULL DEFAULT ''",
        };
        foreach (var sql in columnMigrations)
            try { db.Database.ExecuteSqlRaw(sql); } catch { }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<OrderHub>("/hubs/orders");
app.Run();
