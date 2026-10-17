using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BabyRoutine.Application.Common.Models;
using BabyRoutine.Application.Engines;
using BabyRoutine.Application.Features.Auth;
using BabyRoutine.Application.Features.Diapers;
using BabyRoutine.Application.Features.Health;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BabyRoutine.Tests;

public class ClinicalEnginesTests
{
    [Theory]
    [InlineData(0, 45, 60, 5)]
    [InlineData(1, 60, 90, 4)]
    [InlineData(3, 75, 120, 4)]
    [InlineData(5, 90, 150, 3)]
    [InlineData(7, 120, 180, 2)]
    [InlineData(12, 180, 240, 2)]
    [InlineData(16, 240, 330, 1)]
    public void WakeWindowEngine_ReturnsExpectedFisiologicalRange(int ageMonths, int minMins, int maxMins, int expectedNaps)
    {
        var range = WakeWindowEngine.GetFisiologicalRange(ageMonths);
        Assert.Equal(minMins, range.Min.TotalMinutes);
        Assert.Equal(maxMins, range.Max.TotalMinutes);
        Assert.Equal(expectedNaps, range.ExpectedNaps);
    }

    [Fact]
    public void WakeWindowEngine_CalculatesSweetSpotAndOverdueStatesCorrectly()
    {
        var engine = new WakeWindowEngine();
        var now = new DateTime(2026, 10, 17, 14, 0, 0, DateTimeKind.Utc);

        var normalStatus = engine.CalculateStatus(now.AddMinutes(-60), 7, now);
        Assert.Equal("Normal", normalStatus.AlertLevel);
        Assert.Equal(60, normalStatus.RemainingMinutesToSweetSpot);

        var optimalStatus = engine.CalculateStatus(now.AddMinutes(-150), 7, now);
        Assert.Equal("Optimal", optimalStatus.AlertLevel);
        Assert.Equal(0, optimalStatus.RemainingMinutesToSweetSpot);

        var overdueStatus = engine.CalculateStatus(now.AddMinutes(-210), 7, now);
        Assert.Equal("Overdue", overdueStatus.AlertLevel);
    }

    [Fact]
    public void MedicationSafetyEngine_BlocksShortIntervalsAndOverdoses()
    {
        var now = DateTime.UtcNow;

        var safeResult = MedicationSafetyEngine.ValidateDose("Paracetamol Gotas", 6.0, 75, now, now.AddHours(-6.5));
        Assert.True(safeResult.IsSafe);

        var shortIntervalResult = MedicationSafetyEngine.ValidateDose("Paracetamol Gotas", 6.0, 75, now, now.AddHours(-3));
        Assert.False(shortIntervalResult.IsSafe);
        Assert.Contains("INTERVALO INSUFICIENTE", shortIntervalResult.Message);

        var overdoseResult = MedicationSafetyEngine.ValidateDose("Paracetamol Gotas", 6.0, 130, now, null);
        Assert.False(overdoseResult.IsSafe);
        Assert.Contains("ALERTA DE SEGURANÇA", overdoseResult.Message);

        var ibuShortResult = MedicationSafetyEngine.ValidateDose("Ibuprofeno 100mg/mL", 8.0, 70, now, now.AddHours(-7));
        Assert.False(ibuShortResult.IsSafe);
    }

    [Fact]
    public void PediatricStoolClassifier_DetectsAcholicMelenaAndBloodRedFlags()
    {
        var acholic = PediatricStoolClassifier.Evaluate("WhiteGrey", "LiquidPastous", false, 60);
        Assert.True(acholic.IsClinicalAlert);
        Assert.Equal("Emergency", acholic.UrgencyLevel);

        var melena = PediatricStoolClassifier.Evaluate("Black", "MoldedPastous", false, 30);
        Assert.True(melena.IsClinicalAlert);
        Assert.Equal("Urgent", melena.UrgencyLevel);

        var blood = PediatricStoolClassifier.Evaluate("Mustard", "LiquidPastous", true, 90);
        Assert.True(blood.IsClinicalAlert);
        Assert.Equal("HighPriority", blood.UrgencyLevel);

        var normal = PediatricStoolClassifier.Evaluate("Mustard", "LiquidPastous", false, 90);
        Assert.False(normal.IsClinicalAlert);
        Assert.Equal("Normal", normal.UrgencyLevel);
    }

    [Fact]
    public void BabyModel_CalculatesChronologicalAndCorrectedAgeForPrematureBabies()
    {
        var refDate = new DateTime(2026, 10, 17, 12, 0, 0, DateTimeKind.Utc);
        var prematureBaby = new Baby
        {
            BirthDate = refDate.AddDays(-120),
            GestationalWeeks = 34,
            GestationalDays = 0
        };

        Assert.Equal(120, prematureBaby.GetChronologicalAgeDays(refDate));
        Assert.Equal(78, prematureBaby.GetCorrectedAgeDays(refDate));
    }
}

public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IGoogleSsoValidator>();
                services.AddSingleton<IGoogleSsoValidator, TestGoogleSsoValidator>();
            });
        });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task HealthAndProtectedEndpoints_EnforceGoogleSsoAndReturnValidClinicalPayloads()
    {
        var healthRes = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, healthRes.StatusCode);

        // Unauthenticated requests to protected endpoints must return 401 Unauthorized
        var unauthBabiesRes = await _client.GetAsync("/api/babies");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthBabiesRes.StatusCode);

        // Authenticate via Google SSO IdToken
        var loginRes = await _client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequestDto(
            IdToken: "test-google-id-token:sub-user-1:user1@example.com:User One"
        ));
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);
        var loginPayload = await loginRes.Content.ReadFromJsonAsync<JsonElement>();
        var token = loginPayload.GetProperty("token").GetString()!;

        using var authClient = _factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var createBabyRes = await authClient.PostAsJsonAsync("/api/babies", new CreateChildRequestDto(
            Name: "Child One",
            BirthDate: DateTime.UtcNow.AddDays(-210),
            GestationalWeeks: 39,
            GestationalDays: 0,
            Gender: "M",
            BirthWeightGrams: 3200,
            BirthLengthCm: 49.0,
            CurrentWeightGrams: 7800,
            CurrentHeightCm: 68.0,
            HeadCircumferenceCm: 44.0,
            BloodType: "O+"
        ));
        Assert.Equal(HttpStatusCode.Created, createBabyRes.StatusCode);
        var createdBaby = await createBabyRes.Content.ReadFromJsonAsync<Baby>();
        Assert.NotNull(createdBaby);
        var babyId = createdBaby!.Id;

        var timelineRes = await authClient.GetAsync($"/api/babies/{babyId}/timeline");
        Assert.Equal(HttpStatusCode.OK, timelineRes.StatusCode);

        var wakeRes = await authClient.GetAsync($"/api/babies/{babyId}/sleep/wake-window");
        Assert.Equal(HttpStatusCode.OK, wakeRes.StatusCode);

        var diaperDto = new QuickDiaperDto("E2", 2, "WhiteGrey", "MoldedPastous", false, false, true, "Teste de alerta clínico");
        var postDiaper = await authClient.PostAsJsonAsync($"/api/babies/{babyId}/diapers/quick", diaperDto);
        Assert.Equal(HttpStatusCode.Created, postDiaper.StatusCode);
        var createdEvent = await postDiaper.Content.ReadFromJsonAsync<RoutineEvent>();
        Assert.NotNull(createdEvent);
        Assert.True(createdEvent!.ClinicalFlags.IsRedFlagAlert);
        Assert.Equal("Emergency", createdEvent.ClinicalFlags.UrgencyLevel);

        var overdoseDto = new AdministerMedicationDto("Paracetamol Gotas", 300, "30 gotas", 38.5, "Febre", null);
        var postOverdose = await authClient.PostAsJsonAsync($"/api/babies/{babyId}/medications/administer", overdoseDto);
        Assert.Equal(HttpStatusCode.BadRequest, postOverdose.StatusCode);

        var reportRes = await authClient.GetAsync($"/api/babies/{babyId}/reports/pediatric-summary");
        Assert.Equal(HttpStatusCode.OK, reportRes.StatusCode);
    }

    [Fact]
    public async Task GoogleSsoAuth_IsolatesDataByUserAndByChild()
    {
        // 1. Login via Google SSO como Usuário A
        var userALogin = await _client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequestDto(
            IdToken: "test-google-id-token:google-sub-parent-a:parent.a@example.com:Parent A"
        ));
        Assert.Equal(HttpStatusCode.OK, userALogin.StatusCode);
        var userAPayload = await userALogin.Content.ReadFromJsonAsync<JsonElement>();
        var userAToken = userAPayload.GetProperty("token").GetString()!;
        Assert.Empty(userAPayload.GetProperty("babies").EnumerateArray());

        using var clientA = _factory.CreateClient();
        clientA.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userAToken);

        // 2. Usuário A cadastra 2 filhos separados
        var child1Res = await clientA.PostAsJsonAsync("/api/babies", new CreateChildRequestDto(
            Name: "First Child A",
            BirthDate: DateTime.UtcNow.AddDays(-180),
            GestationalWeeks: 38,
            GestationalDays: 2,
            Gender: "M",
            BirthWeightGrams: 3100,
            BirthLengthCm: 48.5,
            CurrentWeightGrams: 7200,
            CurrentHeightCm: 66.0,
            HeadCircumferenceCm: 43.0,
            BloodType: "A+"
        ));
        var child1 = (await child1Res.Content.ReadFromJsonAsync<Baby>())!;

        var child2Res = await clientA.PostAsJsonAsync("/api/babies", new CreateChildRequestDto(
            Name: "Second Child A",
            BirthDate: DateTime.UtcNow.AddDays(-45),
            GestationalWeeks: 39,
            GestationalDays: 1,
            Gender: "F",
            BirthWeightGrams: 3300,
            BirthLengthCm: 49.5,
            CurrentWeightGrams: 4400,
            CurrentHeightCm: 54.0,
            HeadCircumferenceCm: 37.5,
            BloodType: "O+"
        ));
        var child2 = (await child2Res.Content.ReadFromJsonAsync<Baby>())!;

        // Registra evento apenas no Filho 1
        await clientA.PostAsJsonAsync($"/api/babies/{child1.Id}/diapers/quick",
            new QuickDiaperDto("U2", 2, null, null, false, false, true, null));

        // 3. Isolamento por Filho dentro da mesma Conta Google
        var child1Timeline = await clientA.GetFromJsonAsync<JsonElement>($"/api/babies/{child1.Id}/timeline");
        var child2Timeline = await clientA.GetFromJsonAsync<JsonElement>($"/api/babies/{child2.Id}/timeline");
        Assert.Single(child1Timeline.GetProperty("events").EnumerateArray());
        Assert.Empty(child2Timeline.GetProperty("events").EnumerateArray());

        // 4. Login via Google SSO como Usuário B e verificação de isolamento entre usuários
        var userBLogin = await _client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequestDto(
            AccessToken: "test-google-access-token:google-sub-parent-b:parent.b@example.com:Parent B"
        ));
        var userBPayload = await userBLogin.Content.ReadFromJsonAsync<JsonElement>();
        var userBToken = userBPayload.GetProperty("token").GetString()!;

        using var clientB = _factory.CreateClient();
        clientB.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userBToken);

        var forbiddenRes = await clientB.GetAsync($"/api/babies/{child1.Id}/timeline");
        Assert.Equal(HttpStatusCode.NotFound, forbiddenRes.StatusCode);
    }

    private sealed class TestGoogleSsoValidator : IGoogleSsoValidator
    {
        public Task<GoogleSsoPayload> ValidateAsync(GoogleLoginRequestDto dto, CancellationToken ct = default)
        {
            var raw = dto.IdToken ?? dto.AccessToken ?? dto.AuthorizationCode;
            if (string.IsNullOrWhiteSpace(raw) || !raw.StartsWith("test-google-"))
            {
                throw new UnauthorizedAccessException("Token Google SSO inválido.");
            }

            var parts = raw.Split(':');
            var sub = parts.Length > 1 ? parts[1] : "sub-default";
            var email = parts.Length > 2 ? parts[2] : "user@example.com";
            var name = parts.Length > 3 ? parts[3] : "User";

            return Task.FromResult(new GoogleSsoPayload(
                GoogleSub: sub,
                Email: email,
                EmailVerified: true,
                Name: name,
                PictureUrl: string.Empty
            ));
        }
    }
}
