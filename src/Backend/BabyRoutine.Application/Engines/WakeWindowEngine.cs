using BabyRoutine.Application.Common.Models;

namespace BabyRoutine.Application.Engines;

public class WakeWindowEngine
{
    public record WakeWindowRange(TimeSpan Min, TimeSpan Max, int ExpectedNaps, string StageDescription);

    public static WakeWindowRange GetFisiologicalRange(int ageInMonths) => ageInMonths switch
    {
        0 => new(TimeSpan.FromMinutes(45), TimeSpan.FromMinutes(60), ExpectedNaps: 5, "Recém-nascido (0–1 mês): Ritmo ultradiano, sono ativo REM dominante"),
        1 => new(TimeSpan.FromMinutes(60), TimeSpan.FromMinutes(90), ExpectedNaps: 4, "1 a 2 meses: Ciclos curtos (50–60 min), janelas de 60 a 90 min"),
        2 or 3 => new(TimeSpan.FromMinutes(75), TimeSpan.FromMinutes(120), ExpectedNaps: 4, "3 a 4 meses: Início da maturação circadiana, janelas de 75 a 120 min"),
        4 or 5 => new(TimeSpan.FromMinutes(90), TimeSpan.FromMinutes(150), ExpectedNaps: 3, "4 a 5 meses: Transição de 4 para 3 sonecas (1h30 a 2h30)"),
        6 or 7 or 8 => new(TimeSpan.FromMinutes(120), TimeSpan.FromMinutes(180), ExpectedNaps: 2, "6 a 8 meses: Transição de 3 para 2 sonecas (2h a 3h)"),
        >= 9 and <= 13 => new(TimeSpan.FromMinutes(180), TimeSpan.FromMinutes(240), ExpectedNaps: 2, "9 a 13 meses: 2 sonecas consolidadas (3h a 4h)"),
        >= 14 and <= 18 => new(TimeSpan.FromMinutes(240), TimeSpan.FromMinutes(330), ExpectedNaps: 1, "14 a 18 meses: Transição de 2 para 1 soneca pós-almoço (4h a 5h30)"),
        >= 19 and <= 24 => new(TimeSpan.FromMinutes(300), TimeSpan.FromMinutes(360), ExpectedNaps: 1, "19 a 24 meses: 1 soneca diurna consolidada (5h a 6h)"),
        _ => new(TimeSpan.FromMinutes(300), TimeSpan.FromMinutes(420), ExpectedNaps: 1, "Acima de 24 meses: 1 soneca ou vigília contínua")
    };

    public WakeWindowStatus CalculateStatus(DateTime lastWakeTime, int ageInMonths, DateTime? referenceUtc = null)
    {
        var now = referenceUtc ?? DateTime.UtcNow;
        var awakeDuration = now > lastWakeTime ? now - lastWakeTime : TimeSpan.Zero;
        var range = GetFisiologicalRange(ageInMonths);

        var idealSleepStart = lastWakeTime + range.Min;
        var maximumSleepStart = lastWakeTime + range.Max;

        if (awakeDuration < range.Min)
        {
            return new WakeWindowStatus(
                AwakeDurationMinutes: (int)awakeDuration.TotalMinutes,
                MinWindowMinutes: (int)range.Min.TotalMinutes,
                MaxWindowMinutes: (int)range.Max.TotalMinutes,
                ExpectedNaps: range.ExpectedNaps,
                StageDescription: range.StageDescription,
                State: "Bebê Tranquilo / Período de Brincadeiras e Estímulo",
                AlertLevel: "Normal",
                IdealSleepTime: idealSleepStart,
                MaxSleepTime: maximumSleepStart,
                RemainingMinutesToSweetSpot: Math.Max(0, (int)Math.Ceiling((idealSleepStart - now).TotalMinutes)),
                EnvironmentSuggestion: "Luz natural, interação ativa, tummy time e alimentação conforme sinais precoces."
            );
        }

        if (awakeDuration >= range.Min && awakeDuration <= range.Max)
        {
            return new WakeWindowStatus(
                AwakeDurationMinutes: (int)awakeDuration.TotalMinutes,
                MinWindowMinutes: (int)range.Min.TotalMinutes,
                MaxWindowMinutes: (int)range.Max.TotalMinutes,
                ExpectedNaps: range.ExpectedNaps,
                StageDescription: range.StageDescription,
                State: "Sweet Spot: Momento Ideal para Ritual de Sono",
                AlertLevel: "Optimal",
                IdealSleepTime: now,
                MaxSleepTime: maximumSleepStart,
                RemainingMinutesToSweetSpot: 0,
                EnvironmentSuggestion: "Quarto com blackout, ruído branco contínuo e desaceleração de estímulos visuais."
            );
        }

        return new WakeWindowStatus(
            AwakeDurationMinutes: (int)awakeDuration.TotalMinutes,
            MinWindowMinutes: (int)range.Min.TotalMinutes,
            MaxWindowMinutes: (int)range.Max.TotalMinutes,
            ExpectedNaps: range.ExpectedNaps,
            StageDescription: range.StageDescription,
            State: "Alerta de Janela Ultrapassada: Risco de Cortisol Alto e Choro",
            AlertLevel: "Overdue",
            IdealSleepTime: maximumSleepStart,
            MaxSleepTime: maximumSleepStart,
            RemainingMinutesToSweetSpot: 0,
            EnvironmentSuggestion: "Acolhimento imediato no escuro, contato pele a pele ou balanço rítmico para reduzir o cortisol."
        );
    }

    public NapTransitionReadiness EvaluateNapTransitionReadiness(int ageInMonths, IEnumerable<RoutineEvent> recentSleepEvents)
    {
        var naps = recentSleepEvents
            .Where(e => e.Category == RoutineCategory.Sleep && e.Details.SleepType == "Nap")
            .OrderByDescending(e => e.Timestamp)
            .ToList();

        var daysWithResistance = naps
            .Where(n => n.Details.HadResistance || (n.DurationMinutes.HasValue && n.DurationMinutes.Value < 35))
            .Select(n => n.Timestamp.Date)
            .Distinct()
            .Count();

        string targetTransition = ageInMonths switch
        {
            >= 4 and <= 5 => "Transição de 4 para 3 sonecas (4–5 meses)",
            >= 7 and <= 9 => "Transição de 3 para 2 sonecas (7–9 meses)",
            >= 14 and <= 18 => "Transição de 2 para 1 soneca consolidada pós-almoço (14–18 meses)",
            _ => "Sem transição fisiológica típica na faixa atual"
        };

        bool isInTransitionAge = (ageInMonths is >= 4 and <= 5) || (ageInMonths is >= 7 and <= 9) || (ageInMonths is >= 14 and <= 18);
        bool isReady = daysWithResistance >= 7 && isInTransitionAge;

        var averageWakeWindow = naps
            .Where(n => n.Details.WakeWindowPrecedingMinutes.HasValue)
            .Select(n => n.Details.WakeWindowPrecedingMinutes!.Value)
            .DefaultIfEmpty(0)
            .Average();

        string recommendation = naps.Count == 0
            ? "Nenhuma soneca registrada ainda."
            : isReady
                ? $"Resistência detectada em {daysWithResistance} dias dos últimos 10 dias. Recomendado ampliar a janela de vigília em 15 minutos e consolidar {targetTransition}."
                : daysWithResistance >= 3
                    ? $"Observada resistência pontual em {daysWithResistance} dias. Continue monitorando até completar 7–10 dias seguidos antes de remover uma soneca (pode ser salto de desenvolvimento ou dentição)."
                    : "Padrão de sonecas estável e adequado para a faixa etária.";

        return new NapTransitionReadiness(
            AgeInMonths: ageInMonths,
            TargetTransition: targetTransition,
            DaysWithResistanceLast10Days: daysWithResistance,
            RequiredConsecutiveDaysThreshold: 7,
            IsTransitionRecommended: isReady,
            AverageRealWakeWindowMinutes: (int)Math.Round(averageWakeWindow),
            ClinicalRecommendation: recommendation
        );
    }
}

public record WakeWindowStatus(
    int AwakeDurationMinutes,
    int MinWindowMinutes,
    int MaxWindowMinutes,
    int ExpectedNaps,
    string StageDescription,
    string State,
    string AlertLevel,
    DateTime IdealSleepTime,
    DateTime MaxSleepTime,
    int RemainingMinutesToSweetSpot,
    string EnvironmentSuggestion
);

public record NapTransitionReadiness(
    int AgeInMonths,
    string TargetTransition,
    int DaysWithResistanceLast10Days,
    int RequiredConsecutiveDaysThreshold,
    bool IsTransitionRecommended,
    int AverageRealWakeWindowMinutes,
    string ClinicalRecommendation
);
