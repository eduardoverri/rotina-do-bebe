using BabyRoutine.Api.Filters;
using BabyRoutine.Api.Hubs;
using BabyRoutine.Api.Services;
using BabyRoutine.Application.Common.Interfaces;
using BabyRoutine.Application.Common.Models;
using BabyRoutine.Application.Engines;
using BabyRoutine.Application.Features.Auth;
using BabyRoutine.Application.Features.Diapers;
using BabyRoutine.Application.Features.Feeding;
using BabyRoutine.Application.Features.Health;
using BabyRoutine.Application.Features.RoutineEvents.CreateEvent;
using BabyRoutine.Application.Features.RoutineEvents.GetDailyTimeline;
using BabyRoutine.Infrastructure.Persistence;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Bson;

namespace BabyRoutine.Api.Extensions;

public static class EndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapBabyRoutineEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        // =========================================================================
        // 0. Autenticação com Google SSO (OpenID Connect / OAuth 2.0)
        // =========================================================================
        var authGroup = api.MapGroup("/auth");

        authGroup.MapGet("/config", (GoogleAuthService googleAuth) => Results.Ok(new
        {
            googleClientId = googleAuth.GoogleClientId ?? string.Empty,
            allowClientIdConfiguration = !googleAuth.HasEnvGoogleClientId
        }))
        .WithName("GetGoogleSsoConfig");

        authGroup.MapPut("/config", (GoogleSsoClientConfigDto dto, GoogleAuthService googleAuth) =>
        {
            if (googleAuth.HasEnvGoogleClientId)
            {
                return Results.BadRequest(new { message = "O Google Client ID já está configurado via variável de ambiente GOOGLE_CLIENT_ID." });
            }

            googleAuth.SetRuntimeClientId(dto.ClientId);
            return Results.Ok(new
            {
                googleClientId = googleAuth.GoogleClientId ?? string.Empty,
                allowClientIdConfiguration = !googleAuth.HasEnvGoogleClientId
            });
        })
        .WithName("UpdateGoogleSsoConfig");

        authGroup.MapPost("/google", async (
            GoogleLoginRequestDto dto,
            IGoogleSsoValidator ssoValidator,
            GoogleAuthService googleAuth,
            IUserRepository userRepo,
            IFamilyRepository familyRepo,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            try
            {
                var payload = await ssoValidator.ValidateAsync(dto, ct);
                var user = await userRepo.UpsertGoogleUserAsync(
                    payload.GoogleSub,
                    payload.Email,
                    payload.Name,
                    payload.PictureUrl,
                    ct
                );
                var family = await familyRepo.GetOrCreateFamilyForUserAsync(user, ct);
                var babies = await babyRepo.GetByOwnerUserIdAsync(user.Id, ct);
                var token = googleAuth.GenerateJwtToken(user);

                return Results.Ok(new
                {
                    token,
                    user,
                    family,
                    babies,
                    googleClientId = googleAuth.GoogleClientId
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { message = ex.Message }, statusCode: StatusCodes.Status401Unauthorized);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        })
        .WithName("GoogleSignIn")
        .WithSummary("Autentica o usuário via Google SSO (OIDC ID Token, OAuth2 Access Token ou Authorization Code) e retorna JWT + filhos isolados do usuário");

        authGroup.MapGet("/me", async (
            HttpContext httpContext,
            IUserRepository userRepo,
            IFamilyRepository familyRepo,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            var user = await httpContext.GetOrRestoreCurrentUserAsync(userRepo, ct);
            if (user is null) return Results.Unauthorized();

            var family = await familyRepo.GetOrCreateFamilyForUserAsync(user, ct);
            var babies = await babyRepo.GetByOwnerUserIdAsync(user.Id, ct);
            return Results.Ok(new { user, family, babies });
        })
        .RequireAuthorization()
        .WithName("GetCurrentAuthenticatedUser");

        // =========================================================================
        // 1. Gestão de Família e Filhos Isolados por Usuário Google + Sincronização Pós-Deploy
        // =========================================================================
        api.MapGet("/families/current", async (
            HttpContext httpContext,
            IUserRepository userRepo,
            IFamilyRepository familyRepo,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            var user = await httpContext.GetOrRestoreCurrentUserAsync(userRepo, ct);
            if (user is null) return Results.Unauthorized();

            var family = await familyRepo.GetOrCreateFamilyForUserAsync(user, ct);
            var babies = await babyRepo.GetByOwnerUserIdAsync(user.Id, ct);
            return Results.Ok(new { user, family, babies });
        })
        .RequireAuthorization()
        .WithName("GetCurrentFamily")
        .WithSummary("Retorna a família do usuário autenticado e apenas os filhos vinculados a esta conta Google");

        api.MapPost("/sync/restore", async (
            HttpContext httpContext,
            RestoreUserStateRequestDto dto,
            IUserRepository userRepo,
            IFamilyRepository familyRepo,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            IAllergenTrialRepository allergenRepo,
            IMilestoneRepository milestoneRepo,
            CancellationToken ct) =>
        {
            var user = await httpContext.GetOrRestoreCurrentUserAsync(userRepo, ct);
            if (user is null) return Results.Unauthorized();

            var family = await familyRepo.GetOrCreateFamilyForUserAsync(user, ct);

            if (dto.Babies is { Count: > 0 })
            {
                foreach (var incoming in dto.Babies)
                {
                    if (string.IsNullOrWhiteSpace(incoming.Name)) continue;

                    if (string.IsNullOrWhiteSpace(incoming.Id) || !ObjectId.TryParse(incoming.Id, out _))
                    {
                        incoming.Id = ObjectId.GenerateNewId().ToString();
                    }

                    incoming.OwnerUserId = user.Id;
                    incoming.FamilyId = user.FamilyId;

                    var existing = await babyRepo.GetByIdAndUserAsync(incoming.Id, user.Id, ct);
                    if (existing is not null)
                    {
                        var mergedLogs = existing.GrowthLogs
                            .Concat(incoming.GrowthLogs ?? [])
                            .GroupBy(g => $"{g.MeasuredAt:yyyy-MM-ddTHH:mm}_{g.WeightGrams}_{g.HeightCm}_{g.HeadCircumferenceCm}")
                            .Select(g => g.First())
                            .OrderBy(g => g.MeasuredAt)
                            .ToList();

                        if (mergedLogs.Count > 0)
                        {
                            existing.GrowthLogs = mergedLogs;
                            var latest = mergedLogs.Last();
                            existing.CurrentWeightGrams = latest.WeightGrams;
                            existing.CurrentHeightCm = latest.HeightCm;
                            existing.HeadCircumferenceCm = latest.HeadCircumferenceCm;
                        }
                        else
                        {
                            if (incoming.CurrentWeightGrams > 0) existing.CurrentWeightGrams = incoming.CurrentWeightGrams;
                            if (incoming.CurrentHeightCm > 0) existing.CurrentHeightCm = incoming.CurrentHeightCm;
                            if (incoming.HeadCircumferenceCm > 0) existing.HeadCircumferenceCm = incoming.HeadCircumferenceCm;
                        }

                        await babyRepo.UpdateAsync(existing, ct);
                    }
                    else
                    {
                        if (incoming.Vaccines is null or { Count: 0 })
                        {
                            incoming.Vaccines = SeedData.CreateDefaultVaccines();
                        }
                        if (incoming.GrowthLogs is null or { Count: 0 })
                        {
                            incoming.GrowthLogs =
                            [
                                new GrowthLog
                                {
                                    MeasuredAt = incoming.BirthDate,
                                    WeightGrams = incoming.BirthWeightGrams > 0 ? incoming.BirthWeightGrams : incoming.CurrentWeightGrams,
                                    HeightCm = incoming.BirthLengthCm > 0 ? incoming.BirthLengthCm : incoming.CurrentHeightCm,
                                    HeadCircumferenceCm = incoming.HeadCircumferenceCm > 0 ? incoming.HeadCircumferenceCm : 35.0,
                                    ZScoreWeightForAge = 0.0
                                }
                            ];
                        }
                        await babyRepo.InsertAsync(incoming, ct);
                        await milestoneRepo.GetByBabyIdAsync(user.Id, incoming.Id, ct);
                    }
                }
            }

            if (dto.RoutineEvents is { Count: > 0 })
            {
                foreach (var ev in dto.RoutineEvents)
                {
                    if (string.IsNullOrWhiteSpace(ev.BabyId)) continue;
                    ev.OwnerUserId = user.Id;
                    ev.FamilyId = user.FamilyId;
                    ev.RecordedByUserId = user.Id;
                    await eventRepo.UpsertAsync(ev, ct);
                }
            }

            if (dto.AllergenTrials is { Count: > 0 })
            {
                foreach (var trial in dto.AllergenTrials)
                {
                    if (string.IsNullOrWhiteSpace(trial.BabyId)) continue;
                    trial.OwnerUserId = user.Id;
                    await allergenRepo.UpdateAsync(trial, ct);
                }
            }

            if (dto.Milestones is { Count: > 0 })
            {
                foreach (var ms in dto.Milestones)
                {
                    if (string.IsNullOrWhiteSpace(ms.BabyId) || string.IsNullOrWhiteSpace(ms.MilestoneCode)) continue;
                    ms.OwnerUserId = user.Id;
                    await milestoneRepo.UpdateAsync(ms, ct);
                }
            }

            var babies = await babyRepo.GetByOwnerUserIdAsync(user.Id, ct);
            return Results.Ok(new { user, family, babies });
        })
        .RequireAuthorization()
        .WithName("RestoreUserStateAfterDeploy")
        .WithSummary("Sincroniza e restaura filhos e registros do usuário caso o container tenha sido recriado em novo deploy");

        api.MapGet("/babies", async (
            HttpContext httpContext,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            if (string.IsNullOrWhiteSpace(userId)) return Results.Unauthorized();
            var babies = await babyRepo.GetByOwnerUserIdAsync(userId, ct);
            return Results.Ok(babies);
        })
        .RequireAuthorization()
        .WithName("GetUserBabies")
        .WithSummary("Lista exclusivamente os filhos do usuário Google autenticado");

        api.MapPost("/babies", async (
            HttpContext httpContext,
            CreateChildRequestDto dto,
            IUserRepository userRepo,
            IBabyRepository babyRepo,
            IMilestoneRepository milestoneRepo,
            CancellationToken ct) =>
        {
            var user = await httpContext.GetOrRestoreCurrentUserAsync(userRepo, ct);
            if (user is null) return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return Results.BadRequest(new { message = "O nome do filho(a) é obrigatório." });
            }

            var now = DateTime.UtcNow;

            var newBaby = new Baby
            {
                Id = ObjectId.GenerateNewId().ToString(),
                OwnerUserId = user.Id,
                FamilyId = user.FamilyId,
                Name = dto.Name.Trim(),
                BirthDate = dto.BirthDate,
                GestationalWeeks = dto.GestationalWeeks,
                GestationalDays = dto.GestationalDays,
                Gender = dto.Gender,
                BirthWeightGrams = dto.BirthWeightGrams,
                BirthLengthCm = dto.BirthLengthCm,
                CurrentWeightGrams = dto.CurrentWeightGrams > 0 ? dto.CurrentWeightGrams : dto.BirthWeightGrams,
                CurrentHeightCm = dto.CurrentHeightCm > 0 ? dto.CurrentHeightCm : dto.BirthLengthCm,
                HeadCircumferenceCm = dto.HeadCircumferenceCm > 0 ? dto.HeadCircumferenceCm : 35.0,
                BloodType = string.IsNullOrWhiteSpace(dto.BloodType) ? "O+" : dto.BloodType,
                Pediatrician = new PediatricianInfo
                {
                    Name = dto.PediatricianName ?? string.Empty,
                    Crm = dto.PediatricianCrm ?? string.Empty,
                    EmergencyPhone = dto.PediatricianPhone ?? string.Empty
                },
                ActiveMedications = [],
                GrowthLogs =
                [
                    new GrowthLog
                    {
                        MeasuredAt = dto.BirthDate,
                        WeightGrams = dto.BirthWeightGrams,
                        HeightCm = dto.BirthLengthCm,
                        HeadCircumferenceCm = dto.HeadCircumferenceCm > 0 ? dto.HeadCircumferenceCm : 35.0,
                        ZScoreWeightForAge = 0.0
                    }
                ],
                Vaccines = SeedData.CreateDefaultVaccines(),
                CreatedAt = now
            };

            await babyRepo.InsertAsync(newBaby, ct);
            // Inicializa a árvore de marcos motores exclusiva para este filho
            await milestoneRepo.GetByBabyIdAsync(user.Id, newBaby.Id, ct);

            return Results.Created($"/api/babies/{newBaby.Id}", newBaby);
        })
        .RequireAuthorization()
        .WithName("CreateChildForUser")
        .WithSummary("Cadastra um novo filho vinculado exclusivamente à conta Google do usuário autenticado");

        var babyGroup = api.MapGroup("/babies/{babyId}").RequireAuthorization();

        babyGroup.MapGet("", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            return baby is not null ? Results.Ok(baby) : Results.NotFound(new { message = "Filho não encontrado nesta conta de usuário." });
        })
        .WithName("GetBabyById");

        babyGroup.MapDelete("", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound(new { message = "Filho não encontrado nesta conta de usuário." });

            await babyRepo.DeleteAsync(babyId, userId, ct);
            return Results.NoContent();
        })
        .WithName("DeleteChildForUser");

        // =========================================================================
        // 2. Registro Genérico ou Rápido de Eventos (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapPost("/events", async (
            string babyId,
            CreateRoutineEventDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            IHubContext<FamilyHub> hub,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound(new { message = "Filho não encontrado para o usuário autenticado." });

            var timestamp = dto.Timestamp ?? DateTime.UtcNow;
            var duration = dto.DurationMinutes;
            if (!duration.HasValue && dto.EndTimestamp.HasValue && dto.EndTimestamp.Value > timestamp)
            {
                duration = (int)Math.Round((dto.EndTimestamp.Value - timestamp).TotalMinutes);
            }

            var eventDoc = new RoutineEvent
            {
                OwnerUserId = userId,
                BabyId = baby.Id,
                FamilyId = baby.FamilyId,
                RecordedByUserId = userId,
                RecordedByName = string.IsNullOrWhiteSpace(dto.RecordedByName) ? httpContext.GetCurrentUserName() : dto.RecordedByName,
                Category = dto.Category,
                Timestamp = timestamp,
                EndTimestamp = dto.EndTimestamp,
                DurationMinutes = duration,
                Details = dto.Details ?? new RoutineEventDetails(),
                Notes = dto.Notes
            };

            if (eventDoc.Category == RoutineCategory.Diaper)
            {
                var flags = PediatricStoolClassifier.Evaluate(
                    eventDoc.Details.StoolColor,
                    eventDoc.Details.StoolConsistency,
                    eventDoc.Details.HasBlood,
                    baby.GetChronologicalAgeDays(timestamp)
                );
                eventDoc.ClinicalFlags = new ClinicalFlags
                {
                    IsRedFlagAlert = flags.IsClinicalAlert,
                    AlertMessage = flags.AlertMessage,
                    UrgencyLevel = flags.UrgencyLevel
                };
            }

            await eventRepo.InsertAsync(eventDoc, ct);

            await hub.Clients.Group($"family_{baby.FamilyId}")
                .SendAsync("EventRecorded", eventDoc, ct);

            return Results.Created($"/api/babies/{babyId}/events/{eventDoc.Id}", eventDoc);
        })
        .AddEndpointFilter<ValidationFilter<CreateRoutineEventDto>>()
        .WithName("CreateRoutineEvent");

        // =========================================================================
        // 3. Timeline Diária e Resumo Sintético (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapGet("/timeline/{date?}", async (
            string babyId,
            string? date,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound(new { message = "Filho não pertence ao usuário autenticado." });

            DateTime targetDate = DateTime.UtcNow.Date;
            if (!string.IsNullOrWhiteSpace(date) && DateTime.TryParse(date, out var parsedDate))
            {
                targetDate = parsedDate.Date;
            }

            var startUtc = targetDate.AddHours(-6);
            var endUtc = targetDate.AddDays(1).AddHours(6);

            var events = await eventRepo.GetByBabyAndDateRangeAsync(userId, baby.Id, startUtc, endUtc, ct);
            if (events.Count == 0)
            {
                events = await eventRepo.GetRecentByBabyAsync(userId, baby.Id, 25, ct);
            }

            var sleepEvents = events.Where(e => e.Category == RoutineCategory.Sleep).ToList();
            var totalSleepMinutes = sleepEvents.Sum(e => e.DurationMinutes ?? 0);
            var napCount = sleepEvents.Count(e => e.Details.SleepType == "Nap");
            var ageMonths = baby.GetEffectiveAgeMonthsForDevelopment();
            var expectedNaps = WakeWindowEngine.GetFisiologicalRange(ageMonths).ExpectedNaps;

            var diaperEvents = events.Where(e => e.Category == RoutineCategory.Diaper).ToList();
            var urineCount = diaperEvents.Count(e => e.Details.State is "U" or "M");
            var stoolCount = diaperEvents.Count(e => e.Details.State is "E" or "M");

            var hydrationEval = PediatricStoolClassifier.EvaluateDailyDiaperFrequency(ageMonths, diaperEvents.Count, urineCount);

            var lastFeeding = events.FirstOrDefault(e => e.Category == RoutineCategory.Feeding);
            string lastFeedingSummary = "Nenhuma refeição registrada hoje";
            if (lastFeeding is not null)
            {
                var minsAgo = Math.Max(1, (int)(DateTime.UtcNow - lastFeeding.Timestamp).TotalMinutes);
                var agoFormatted = minsAgo >= 60 ? $"{minsAgo / 60}h {minsAgo % 60}m atrás" : $"{minsAgo} min atrás";
                if (lastFeeding.Details.FeedingType == "Breast" && lastFeeding.Details.BreastfeedingDetails is not null)
                {
                    var bf = lastFeeding.Details.BreastfeedingDetails;
                    var totalMin = Math.Max(1, (bf.LeftDurationSeconds + bf.RightDurationSeconds) / 60);
                    var sideLabel = bf.LastSideOffered == "Left" ? "Peito E" : bf.LastSideOffered == "Right" ? "Peito D" : "Ambos";
                    lastFeedingSummary = $"{sideLabel} ({totalMin}m) • {agoFormatted}";
                }
                else if (lastFeeding.Details.FeedingType == "Solids")
                {
                    lastFeedingSummary = $"Sólidos ({lastFeeding.Details.SolidsDetails?.MealType ?? "Refeição"}) • {agoFormatted}";
                }
                else if (lastFeeding.Details.FeedingType == "Formula")
                {
                    lastFeedingSummary = $"Fórmula ({lastFeeding.Details.FormulaVolumeMl ?? 120}mL) • {agoFormatted}";
                }
                else
                {
                    lastFeedingSummary = $"Leite ({lastFeeding.Details.FormulaVolumeMl ?? 120}mL) • {agoFormatted}";
                }
            }

            var lastDiaper = diaperEvents.FirstOrDefault();
            string lastDiaperSummary = lastDiaper is not null
                ? $"{lastDiaper.Timestamp.ToLocalTime():HH:mm} • Código {lastDiaper.Details.State}{lastDiaper.Details.VolumeLevel ?? 2}"
                : "Sem trocas recentes";

            var response = new DailyTimelineResponse(
                BabyId: baby.Id,
                Date: targetDate.ToString("yyyy-MM-dd"),
                TotalEvents: events.Count,
                TotalSleepMinutes: totalSleepMinutes,
                NapCount: napCount,
                ExpectedNaps: expectedNaps,
                TotalDiaperChanges: diaperEvents.Count,
                UrineOrMixedCount: urineCount,
                StoolOrMixedCount: stoolCount,
                IsLowHydrationAlert: hydrationEval.IsLowHydrationAlert,
                HydrationStatusMessage: hydrationEval.StatusMessage,
                LastFeedingSummary: lastFeedingSummary,
                LastDiaperSummary: lastDiaperSummary,
                Events: events
            );

            return Results.Ok(response);
        })
        .WithName("GetDailyTimeline");

        // =========================================================================
        // 4. Sono e Janelas de Vigília (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapGet("/sleep/wake-window", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            WakeWindowEngine wakeEngine,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var recentEvents = await eventRepo.GetRecentByBabyAsync(userId, baby.Id, 30, ct);
            var lastSleepOrWake = recentEvents
                .Where(e => e.Category is RoutineCategory.Sleep or RoutineCategory.WakeUp)
                .OrderByDescending(e => e.EndTimestamp ?? e.Timestamp)
                .FirstOrDefault();

            var lastWakeTime = lastSleepOrWake?.EndTimestamp ?? lastSleepOrWake?.Timestamp ?? DateTime.UtcNow;
            var effectiveMonths = baby.GetEffectiveAgeMonthsForDevelopment();
            var status = wakeEngine.CalculateStatus(lastWakeTime, effectiveMonths);

            return Results.Ok(new
            {
                babyId = baby.Id,
                babyName = baby.Name,
                effectiveAgeMonths = effectiveMonths,
                lastWakeTimeUtc = lastWakeTime,
                status
            });
        })
        .WithName("GetWakeWindowStatus");

        babyGroup.MapGet("/sleep/transition-readiness", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            WakeWindowEngine wakeEngine,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var recentEvents = await eventRepo.GetRecentByBabyAsync(userId, baby.Id, 60, ct);
            var readiness = wakeEngine.EvaluateNapTransitionReadiness(baby.GetEffectiveAgeMonthsForDevelopment(), recentEvents);
            return Results.Ok(readiness);
        })
        .WithName("GetNapTransitionReadiness");

        // =========================================================================
        // 5. Nutrição: Amamentação 1-Toque, Prato dos 4 Grupos e Alérgenos 72h
        // =========================================================================
        babyGroup.MapPost("/feeding/quick-breast", async (
            string babyId,
            QuickBreastfeedingDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            IHubContext<FamilyHub> hub,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var totalSeconds = dto.LeftDurationSeconds + dto.RightDurationSeconds;
            var durationMinutes = Math.Max(1, (int)Math.Round(totalSeconds / 60.0));
            var normalizedSide = dto.Side.StartsWith("L", StringComparison.OrdinalIgnoreCase) ? "Left"
                : dto.Side.StartsWith("R", StringComparison.OrdinalIgnoreCase) ? "Right" : "Both";

            var ev = new RoutineEvent
            {
                OwnerUserId = userId,
                BabyId = baby.Id,
                FamilyId = baby.FamilyId,
                RecordedByUserId = userId,
                RecordedByName = httpContext.GetCurrentUserName(),
                Category = RoutineCategory.Feeding,
                Timestamp = DateTime.UtcNow.AddSeconds(-totalSeconds),
                EndTimestamp = DateTime.UtcNow,
                DurationMinutes = durationMinutes,
                Details = new RoutineEventDetails
                {
                    FeedingType = "Breast",
                    BreastfeedingDetails = new BreastfeedingDetails
                    {
                        LastSideOffered = normalizedSide,
                        LeftDurationSeconds = dto.LeftDurationSeconds,
                        RightDurationSeconds = dto.RightDurationSeconds,
                        HungerCueStage = dto.HungerCueStage ?? "Early",
                        SatietyCues = dto.SatietyCues ?? ["Relaxamento das mãos", "Desprendimento espontâneo"]
                    }
                },
                Notes = dto.Notes ?? $"Amamentação de {baby.Name} concluída ({durationMinutes} min - Último lado: {(normalizedSide == "Left" ? "Esquerdo" : "Direito")})."
            };

            await eventRepo.InsertAsync(ev, ct);
            await hub.Clients.Group($"family_{baby.FamilyId}").SendAsync("EventRecorded", ev, ct);
            return Results.Created($"/api/babies/{babyId}/events/{ev.Id}", ev);
        })
        .WithName("QuickBreastfeedingLog");

        babyGroup.MapPost("/feeding/solids-plate", async (
            string babyId,
            SolidsPlateDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            IAllergenTrialRepository allergenRepo,
            IHubContext<FamilyHub> hub,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var ev = new RoutineEvent
            {
                OwnerUserId = userId,
                BabyId = baby.Id,
                FamilyId = baby.FamilyId,
                RecordedByUserId = userId,
                RecordedByName = httpContext.GetCurrentUserName(),
                Category = RoutineCategory.Feeding,
                Timestamp = DateTime.UtcNow,
                DurationMinutes = 25,
                Details = new RoutineEventDetails
                {
                    FeedingType = "Solids",
                    SolidsDetails = new SolidsDetails
                    {
                        MealType = dto.MealType,
                        FoodGroups = new FoodGroups
                        {
                            FruitsAndVegetables = dto.FruitsAndVegetables,
                            CerealsAndTubers = dto.CerealsAndTubers,
                            Legumes = dto.Legumes,
                            AnimalProtein = dto.AnimalProtein
                        },
                        AcceptanceLevel = dto.AcceptanceLevel,
                        EatingAutonomy = dto.EatingAutonomy,
                        AllergensPresented = dto.AllergensPresented ?? []
                    }
                },
                Notes = dto.Notes ?? $"Prato dos 4 grupos de {baby.Name} ({dto.MealType}) - Aceitação: {dto.AcceptanceLevel}."
            };

            await eventRepo.InsertAsync(ev, ct);

            if (dto.AllergensPresented is { Count: > 0 })
            {
                var existingTrials = await allergenRepo.GetByBabyIdAsync(userId, baby.Id, ct);
                foreach (var allergen in dto.AllergensPresented)
                {
                    if (!existingTrials.Any(t => t.FoodName.Contains(allergen, StringComparison.OrdinalIgnoreCase)))
                    {
                        var newTrial = new AllergenTrial
                        {
                            OwnerUserId = userId,
                            BabyId = baby.Id,
                            FoodName = allergen,
                            FoodCategory = "Introduzido no Prato dos 4 Grupos",
                            IntroducedAt = DateTime.UtcNow,
                            MonitoringEndsAt = DateTime.UtcNow.AddHours(72),
                            Status = "MonitoringActive",
                            ExposureDoses = [new ExposureDose { Day = 1, QuantityOffered = "1ª exposição diurna", ReactionObserved = false }]
                        };
                        await allergenRepo.InsertAsync(newTrial, ct);
                    }
                }
            }

            await hub.Clients.Group($"family_{baby.FamilyId}").SendAsync("EventRecorded", ev, ct);
            return Results.Created($"/api/babies/{babyId}/events/{ev.Id}", ev);
        })
        .WithName("SolidsPlateLog");

        babyGroup.MapGet("/feeding/hunger-satiety-guide", () => Results.Ok(HungerAndSatietyGuideDto.Default))
            .WithName("GetHungerSatietyGuide");

        babyGroup.MapGet("/feeding/allergen-trials", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IAllergenTrialRepository allergenRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var trials = await allergenRepo.GetByBabyIdAsync(userId, baby.Id, ct);
            var enriched = trials.Select(t => new
            {
                trial = t,
                evaluation = AllergenTrialEngine.EvaluateTrial(t)
            });
            return Results.Ok(enriched);
        })
        .WithName("GetAllergenTrials");

        babyGroup.MapPost("/feeding/allergen-trial", async (
            string babyId,
            RegisterAllergenTrialDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IAllergenTrialRepository allergenRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var trial = new AllergenTrial
            {
                OwnerUserId = userId,
                BabyId = baby.Id,
                FoodName = dto.FoodName,
                FoodCategory = dto.FoodCategory,
                IntroducedAt = DateTime.UtcNow,
                MonitoringEndsAt = DateTime.UtcNow.AddHours(72),
                Status = "MonitoringActive",
                ExposureDoses =
                [
                    new ExposureDose
                    {
                        Day = 1,
                        QuantityOffered = dto.InitialQuantityOffered ?? "1/4 colher de chá (período diurno)",
                        ReactionObserved = false
                    }
                ],
                PediatricianNotes = dto.Notes ?? "Janela ativa de monitoramento de 72 horas iniciada."
            };

            await allergenRepo.InsertAsync(trial, ct);
            return Results.Created($"/api/babies/{babyId}/feeding/allergen-trials/{trial.Id}", new
            {
                trial,
                evaluation = AllergenTrialEngine.EvaluateTrial(trial)
            });
        })
        .WithName("RegisterAllergenTrial");

        babyGroup.MapPut("/feeding/allergen-trial/{trialId}", async (
            string babyId,
            string trialId,
            UpdateAllergenTrialSymptomsDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IAllergenTrialRepository allergenRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var trial = await allergenRepo.GetByIdAsync(userId, trialId, ct);
            if (trial is null || trial.BabyId != baby.Id) return Results.NotFound();

            trial.SymptomsChecklist = new SymptomsChecklist
            {
                HivesOrRash = dto.HivesOrRash,
                FacialSwelling = dto.FacialSwelling,
                AcuteVomiting = dto.AcuteVomiting,
                ExplosiveDiarrhea = dto.ExplosiveDiarrhea,
                Wheezing = dto.Wheezing
            };

            if (dto.ExposureDay.HasValue && !string.IsNullOrWhiteSpace(dto.QuantityOffered))
            {
                trial.ExposureDoses.Add(new ExposureDose
                {
                    Day = dto.ExposureDay.Value,
                    QuantityOffered = dto.QuantityOffered,
                    ReactionObserved = trial.SymptomsChecklist.HasAnySymptom
                });
            }

            if (!string.IsNullOrWhiteSpace(dto.PediatricianNotes))
            {
                trial.PediatricianNotes = dto.PediatricianNotes;
            }

            var evaluation = AllergenTrialEngine.EvaluateTrial(trial);
            trial.Status = evaluation.Status;

            await allergenRepo.UpdateAsync(trial, ct);
            return Results.Ok(new { trial, evaluation });
        })
        .WithName("UpdateAllergenTrial");

        // =========================================================================
        // 6. Fraldas Codificadas Rápidas (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapPost("/diapers/quick", async (
            string babyId,
            QuickDiaperDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            IHubContext<FamilyHub> hub,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var rawCode = (dto.Code ?? "U2").Trim().ToUpperInvariant();
            var state = rawCode.Length > 0 ? rawCode[0].ToString() : "U";
            int volume = dto.VolumeLevel ?? (rawCode.Length > 1 && int.TryParse(rawCode[1].ToString(), out var v) ? v : 2);

            var flags = PediatricStoolClassifier.Evaluate(
                dto.StoolColor,
                dto.StoolConsistency,
                dto.HasBlood,
                baby.GetChronologicalAgeDays()
            );

            var ev = new RoutineEvent
            {
                OwnerUserId = userId,
                BabyId = baby.Id,
                FamilyId = baby.FamilyId,
                RecordedByUserId = userId,
                RecordedByName = httpContext.GetCurrentUserName(),
                Category = RoutineCategory.Diaper,
                Timestamp = DateTime.UtcNow,
                Details = new RoutineEventDetails
                {
                    State = state,
                    VolumeLevel = volume,
                    StoolColor = dto.StoolColor,
                    StoolConsistency = dto.StoolConsistency,
                    HasMucus = dto.HasMucus,
                    HasBlood = dto.HasBlood,
                    BarrierCreamApplied = dto.BarrierCreamApplied
                },
                ClinicalFlags = new ClinicalFlags
                {
                    IsRedFlagAlert = flags.IsClinicalAlert,
                    AlertMessage = flags.AlertMessage,
                    UrgencyLevel = flags.UrgencyLevel
                },
                Notes = dto.Notes ?? $"Fralda {state}{volume} de {baby.Name} registrada {(dto.BarrierCreamApplied ? "(Com pomada de barreira)" : "")}."
            };

            await eventRepo.InsertAsync(ev, ct);
            await hub.Clients.Group($"family_{baby.FamilyId}").SendAsync("EventRecorded", ev, ct);

            return Results.Created($"/api/babies/{babyId}/events/{ev.Id}", ev);
        })
        .WithName("QuickDiaperLog");

        // =========================================================================
        // 7. Segurança Medicamentosa (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapPost("/medications/validate", async (
            string babyId,
            AdministerMedicationDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var lastMed = await eventRepo.GetLastMedicationEventAsync(userId, baby.Id, dto.MedicationName, ct);
            var weightKg = Math.Round(baby.CurrentWeightGrams / 1000.0, 2);
            var safety = MedicationSafetyEngine.ValidateDose(
                dto.MedicationName,
                weightKg,
                dto.DoseMg,
                DateTime.UtcNow,
                lastMed?.Timestamp
            );

            return Results.Ok(new
            {
                babyWeightKg = weightKg,
                lastDoseTimestamp = lastMed?.Timestamp,
                safety
            });
        })
        .WithName("ValidateMedicationDose");

        babyGroup.MapPost("/medications/administer", async (
            string babyId,
            AdministerMedicationDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            IHubContext<FamilyHub> hub,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var lastMed = await eventRepo.GetLastMedicationEventAsync(userId, baby.Id, dto.MedicationName, ct);
            var weightKg = Math.Round(baby.CurrentWeightGrams / 1000.0, 2);
            var now = DateTime.UtcNow;

            var safety = MedicationSafetyEngine.ValidateDose(
                dto.MedicationName,
                weightKg,
                dto.DoseMg,
                now,
                lastMed?.Timestamp
            );

            if (!safety.IsSafe)
            {
                return Results.BadRequest(new
                {
                    isSafe = false,
                    message = safety.Message,
                    nextAllowedDose = safety.NextAllowedDose,
                    recommendedDoseMg = safety.RecommendedDoseMg,
                    maxSafeDoseMg = safety.MaxSafeDoseMg
                });
            }

            var ev = new RoutineEvent
            {
                OwnerUserId = userId,
                BabyId = baby.Id,
                FamilyId = baby.FamilyId,
                RecordedByUserId = userId,
                RecordedByName = httpContext.GetCurrentUserName(),
                Category = RoutineCategory.Medication,
                Timestamp = now,
                Details = new RoutineEventDetails
                {
                    MedicationName = dto.MedicationName,
                    DosageGiven = dto.DosageGiven ?? $"{dto.DoseMg} mg",
                    DosageMg = dto.DoseMg,
                    BabyWeightAtTimeKg = weightKg,
                    Reason = dto.Reason ?? "Controle térmico / Analgesia",
                    MeasuredTemperatureCelsius = dto.MeasuredTemperatureCelsius,
                    MinimumIntervalHours = safety.MinimumIntervalHours,
                    NextAllowedDoseAt = safety.NextAllowedDose
                },
                Notes = dto.Notes ?? $"{dto.MedicationName} ({dto.DoseMg}mg) administrado para {baby.Name}."
            };

            await eventRepo.InsertAsync(ev, ct);
            await hub.Clients.Group($"family_{baby.FamilyId}").SendAsync("EventRecorded", ev, ct);

            return Results.Created($"/api/babies/{babyId}/events/{ev.Id}", new
            {
                routineEvent = ev,
                safety
            });
        })
        .WithName("AdministerMedication");

        // =========================================================================
        // 8. Marcos do Desenvolvimento Motor (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapGet("/milestones", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IMilestoneRepository milestoneRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var milestones = await milestoneRepo.GetByBabyIdAsync(userId, baby.Id, ct);
            return Results.Ok(new
            {
                babyId = baby.Id,
                babyName = baby.Name,
                chronologicalAgeDays = baby.GetChronologicalAgeDays(),
                correctedAgeDays = baby.GetCorrectedAgeDays(),
                effectiveAgeMonths = baby.GetEffectiveAgeMonthsForDevelopment(),
                isPremature = baby.GestationalWeeks < 37,
                milestones
            });
        })
        .WithName("GetMotorMilestones");

        babyGroup.MapPut("/milestones/{milestoneCode}", async (
            string babyId,
            string milestoneCode,
            ToggleMilestoneDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IMilestoneRepository milestoneRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var milestone = await milestoneRepo.GetByCodeAsync(userId, baby.Id, milestoneCode, ct);
            if (milestone is null) return Results.NotFound();

            milestone.Status = dto.Status;
            if (dto.Status == "Achieved")
            {
                milestone.AchievedAtDate ??= DateTime.UtcNow;
                milestone.ActualAgeAtAchievementDays ??= baby.GetChronologicalAgeDays();
            }
            else if (dto.Status == "NotStarted")
            {
                milestone.AchievedAtDate = null;
                milestone.ActualAgeAtAchievementDays = null;
            }

            if (!string.IsNullOrWhiteSpace(dto.Notes)) milestone.Notes = dto.Notes;
            if (!string.IsNullOrWhiteSpace(dto.MediaPhotoUrl)) milestone.MediaPhotoUrl = dto.MediaPhotoUrl;

            await milestoneRepo.UpdateAsync(milestone, ct);
            return Results.Ok(milestone);
        })
        .WithName("ToggleMilestoneAchievement");

        // =========================================================================
        // 8.5. Evolução Antropométrica e Curvas OMS (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapGet("/growth", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            return Results.Ok(baby.GrowthLogs.OrderByDescending(g => g.MeasuredAt).ToList());
        })
        .WithName("GetBabyGrowthLogs");

        babyGroup.MapPost("/growth", async (
            string babyId,
            RecordGrowthLogDto dto,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            if (dto.WeightGrams <= 0 || dto.HeightCm <= 0 || dto.HeadCircumferenceCm <= 0)
            {
                return Results.BadRequest(new { message = "Informe valores válidos para peso, comprimento e perímetro cefálico." });
            }

            var measuredAt = dto.MeasuredAt ?? DateTime.UtcNow;
            var effectiveDays = baby.GetCorrectedAgeDays(measuredAt);
            var zScore = dto.ZScoreWeightForAge ?? CalculateWhoWeightForAgeZScore(baby.Gender, effectiveDays, dto.WeightGrams);

            var entry = new GrowthLog
            {
                MeasuredAt = measuredAt,
                WeightGrams = dto.WeightGrams,
                HeightCm = dto.HeightCm,
                HeadCircumferenceCm = dto.HeadCircumferenceCm,
                ZScoreWeightForAge = Math.Round(zScore, 2)
            };

            baby.GrowthLogs.Add(entry);
            baby.GrowthLogs = baby.GrowthLogs.OrderBy(g => g.MeasuredAt).ToList();

            var latest = baby.GrowthLogs.Last();
            baby.CurrentWeightGrams = latest.WeightGrams;
            baby.CurrentHeightCm = latest.HeightCm;
            baby.HeadCircumferenceCm = latest.HeadCircumferenceCm;

            await babyRepo.UpdateAsync(baby, ct);
            return Results.Created($"/api/babies/{babyId}/growth", baby);
        })
        .WithName("RecordBabyGrowthLog");

        // =========================================================================
        // 9. Relatório Pediátrico Consolidado (Separado por Usuário e por Filho)
        // =========================================================================
        babyGroup.MapGet("/reports/pediatric-summary", async (
            string babyId,
            HttpContext httpContext,
            IBabyRepository babyRepo,
            IRoutineEventRepository eventRepo,
            IAllergenTrialRepository allergenRepo,
            IMilestoneRepository milestoneRepo,
            CancellationToken ct) =>
        {
            var userId = httpContext.GetCurrentUserId();
            var baby = await babyRepo.GetByIdAndUserAsync(babyId, userId, ct);
            if (baby is null) return Results.NotFound();

            var events = await eventRepo.GetRecentByBabyAsync(userId, baby.Id, 100, ct);
            var trials = await allergenRepo.GetByBabyIdAsync(userId, baby.Id, ct);
            var milestones = await milestoneRepo.GetByBabyIdAsync(userId, baby.Id, ct);

            var report = PediatricReportEngine.GenerateReport(baby, events, trials, milestones);
            return Results.Ok(report);
        })
        .WithName("GetPediatricSummaryReport");

        return app;
    }

    private static double CalculateWhoWeightForAgeZScore(string gender, int ageDays, double weightGrams)
    {
        // Mediana (M) e Desvio-Padrão aproximado (SD) de Peso para Idade OMS (0 a 24 meses) em gramas
        double months = Math.Clamp(ageDays / 30.4375, 0.0, 24.0);
        bool isFemale = string.Equals(gender, "F", StringComparison.OrdinalIgnoreCase);

        // Pontos de referência OMS (0, 3, 6, 9, 12, 18, 24 meses)
        double[] refMonths = [0, 3, 6, 9, 12, 18, 24];
        double[] medianBoys = [3346, 6376, 7934, 8901, 9647, 10938, 12151];
        double[] sdBoys = [450, 720, 860, 960, 1040, 1180, 1320];
        double[] medianGirls = [3232, 5845, 7297, 8225, 8948, 10231, 11477];
        double[] sdGirls = [430, 680, 820, 920, 1000, 1140, 1280];

        var medians = isFemale ? medianGirls : medianBoys;
        var sds = isFemale ? sdGirls : sdBoys;

        int i = 0;
        while (i < refMonths.Length - 2 && months > refMonths[i + 1])
        {
            i++;
        }

        double t = (months - refMonths[i]) / (refMonths[i + 1] - refMonths[i]);
        double median = medians[i] + t * (medians[i + 1] - medians[i]);
        double sd = sds[i] + t * (sds[i + 1] - sds[i]);

        return Math.Clamp((weightGrams - median) / sd, -4.0, 4.0);
    }
}
