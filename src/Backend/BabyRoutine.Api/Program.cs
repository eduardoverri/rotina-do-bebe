using System.Text;
using BabyRoutine.Api.Extensions;
using BabyRoutine.Api.Hubs;
using BabyRoutine.Api.Services;
using BabyRoutine.Application.Common.Interfaces;
using BabyRoutine.Application.Engines;
using BabyRoutine.Application.Features.Auth;
using BabyRoutine.Application.Features.RoutineEvents.CreateEvent;
using BabyRoutine.Infrastructure.BackgroundJobs;
using BabyRoutine.Infrastructure.Persistence;
using BabyRoutine.Infrastructure.Persistence.Repositories;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// CORS para o Frontend Angular PWA (incluindo SignalR Credentials)
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200",
                "http://127.0.0.1:4200",
                "http://localhost:5000",
                "http://localhost:8080"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configuração de Autenticação JWT emitida após validação do Google SSO (OIDC / OAuth 2.0)
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
                ?? builder.Configuration["Jwt:Secret"]
                ?? "BabyRoutine_SuperSecret_JwtKey_2026_Minimum32BytesLong!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "BabyRoutine.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "BabyRoutine.Frontend";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/family"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// SignalR Real-Time Family Synchronization
builder.Services.AddSignalR();

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreateEventValidator>();

// HttpClient & Google SSO Service + Clinical Engines
builder.Services.AddHttpClient();
builder.Services.AddSingleton<GoogleAuthService>();
builder.Services.AddSingleton<IGoogleSsoValidator>(sp => sp.GetRequiredService<GoogleAuthService>());
builder.Services.AddSingleton<WakeWindowEngine>();
builder.Services.AddSingleton<MedicationSafetyEngine>();
builder.Services.AddSingleton<PediatricStoolClassifier>();
builder.Services.AddSingleton<AllergenTrialEngine>();
builder.Services.AddSingleton<PediatricReportEngine>();

// Persistence Layer (MongoDB 8.0 + In-Memory Store)
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddSingleton<InMemoryDataStore>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IFamilyRepository, FamilyRepository>();
builder.Services.AddScoped<IBabyRepository, BabyRepository>();
builder.Services.AddScoped<IRoutineEventRepository, RoutineEventRepository>();
builder.Services.AddScoped<IAllergenTrialRepository, AllergenTrialRepository>();
builder.Services.AddScoped<IMilestoneRepository, MilestoneRepository>();

// Background Jobs
builder.Services.AddHostedService<MedicationReminderJob>();

var app = builder.Build();

app.UseCors("FrontendPolicy");
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", (MongoDbContext db) => Results.Ok(new
{
    status = "Healthy",
    service = "BabyRoutine.Api (.NET Minimal API + Google SSO)",
    persistenceMode = db.IsMongoConnected ? "MongoDB 8.0" : "InMemory Store",
    timestampUtc = DateTime.UtcNow
}));

app.MapBabyRoutineEndpoints();
app.MapHub<FamilyHub>("/hubs/family");
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
