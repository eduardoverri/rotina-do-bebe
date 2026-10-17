using BabyRoutine.Application.Common.Models;

namespace BabyRoutine.Application.Engines;

public class PediatricReportEngine
{
    public static PediatricSummaryReport GenerateReport(
        Baby baby,
        List<RoutineEvent> events,
        List<AllergenTrial> allergenTrials,
        List<MilestoneProgress> milestones,
        DateTime? referenceUtc = null)
    {
        var now = referenceUtc ?? DateTime.UtcNow;
        var chronoDays = baby.GetChronologicalAgeDays(now);
        var correctedDays = baby.GetCorrectedAgeDays(now);
        var isPremature = baby.GestationalWeeks < 37;

        // Sleep analytics
        var sleepEvents = events.Where(e => e.Category == RoutineCategory.Sleep).ToList();
        var naps = sleepEvents.Where(e => e.Details.SleepType == "Nap").ToList();
        var nightSleeps = sleepEvents.Where(e => e.Details.SleepType == "NightSleep").ToList();

        var totalSleepMinutes = sleepEvents.Sum(e => e.DurationMinutes ?? 0);
        var avgWakeWindow = sleepEvents
            .Where(e => e.Details.WakeWindowPrecedingMinutes.HasValue)
            .Select(e => e.Details.WakeWindowPrecedingMinutes!.Value)
            .DefaultIfEmpty(120)
            .Average();

        // Diaper analytics
        var diaperEvents = events.Where(e => e.Category == RoutineCategory.Diaper).ToList();
        var urineCount = diaperEvents.Count(e => e.Details.State is "U" or "M");
        var stoolCount = diaperEvents.Count(e => e.Details.State is "E" or "M");
        var redFlagAlerts = events
            .Where(e => e.ClinicalFlags.IsRedFlagAlert && !string.IsNullOrEmpty(e.ClinicalFlags.AlertMessage))
            .Select(e => $"{e.Timestamp:dd/MM HH:mm} - {e.ClinicalFlags.AlertMessage}")
            .ToList();

        // Feeding & Solids analytics
        var feedingEvents = events.Where(e => e.Category == RoutineCategory.Feeding).ToList();
        var breastfeedings = feedingEvents.Count(e => e.Details.FeedingType == "Breast");
        var solidsMeals = feedingEvents.Where(e => e.Details.FeedingType == "Solids" && e.Details.SolidsDetails != null).ToList();
        var highAcceptanceMeals = solidsMeals.Count(m => m.Details.SolidsDetails!.AcceptanceLevel == "High");

        // Milestones summary
        var achievedMilestones = milestones.Count(m => m.Status == "Achieved");
        var inProgressMilestones = milestones.Count(m => m.Status == "InProgress");

        return new PediatricSummaryReport(
            BabyId: baby.Id,
            BabyName: baby.Name,
            BirthDate: baby.BirthDate,
            ChronologicalAgeFormatted: FormatDaysToMonthsAndDays(chronoDays),
            CorrectedAgeFormatted: isPremature ? FormatDaysToMonthsAndDays(correctedDays) : "Não aplicável (Nascido a termo)",
            IsPremature: isPremature,
            GestationalAgeFormatted: $"{baby.GestationalWeeks} semanas e {baby.GestationalDays} dias",
            CurrentWeightGrams: baby.CurrentWeightGrams,
            CurrentHeightCm: baby.CurrentHeightCm,
            HeadCircumferenceCm: baby.HeadCircumferenceCm,
            Pediatrician: baby.Pediatrician,
            SleepMetrics: new SleepReportMetrics(
                TotalSleepMinutesLogged: totalSleepMinutes,
                NapCountLogged: naps.Count,
                NightAwakeningsTotal: nightSleeps.Sum(n => n.Details.AwakeningsCount),
                AverageWakeWindowMinutes: (int)Math.Round(avgWakeWindow)
            ),
            DiaperMetrics: new DiaperReportMetrics(
                TotalChanges: diaperEvents.Count,
                UrineOrMixedCount: urineCount,
                StoolOrMixedCount: stoolCount,
                PredominantStoolColor: diaperEvents.FirstOrDefault(d => !string.IsNullOrEmpty(d.Details.StoolColor))?.Details.StoolColor ?? "Mustard",
                PredominantConsistency: diaperEvents.FirstOrDefault(d => !string.IsNullOrEmpty(d.Details.StoolConsistency))?.Details.StoolConsistency ?? "LiquidPastous"
            ),
            FeedingMetrics: new FeedingReportMetrics(
                TotalBreastfeedingsLogged: breastfeedings,
                TotalSolidsMealsLogged: solidsMeals.Count,
                HighAcceptanceRatePercent: solidsMeals.Count > 0 ? (int)Math.Round(highAcceptanceMeals * 100.0 / solidsMeals.Count) : 100,
                SafeAllergensCompleted: allergenTrials.Where(a => a.Status == "SafeCompleted").Select(a => a.FoodName).ToList(),
                ActiveAllergenTrials: allergenTrials.Where(a => a.Status == "MonitoringActive").Select(a => a.FoodName).ToList()
            ),
            MilestonesAchievedCount: achievedMilestones,
            MilestonesInProgressCount: inProgressMilestones,
            TotalMilestonesTracked: milestones.Count,
            GrowthHistory: baby.GrowthLogs,
            ClinicalAlertsTriggered: redFlagAlerts,
            GeneratedAtUtc: now
        );
    }

    private static string FormatDaysToMonthsAndDays(int totalDays)
    {
        var months = totalDays / 30;
        var days = totalDays % 30;
        return $"{months} meses e {days} dias";
    }
}

public record PediatricSummaryReport(
    string BabyId,
    string BabyName,
    DateTime BirthDate,
    string ChronologicalAgeFormatted,
    string CorrectedAgeFormatted,
    bool IsPremature,
    string GestationalAgeFormatted,
    double CurrentWeightGrams,
    double CurrentHeightCm,
    double HeadCircumferenceCm,
    PediatricianInfo Pediatrician,
    SleepReportMetrics SleepMetrics,
    DiaperReportMetrics DiaperMetrics,
    FeedingReportMetrics FeedingMetrics,
    int MilestonesAchievedCount,
    int MilestonesInProgressCount,
    int TotalMilestonesTracked,
    List<GrowthLog> GrowthHistory,
    List<string> ClinicalAlertsTriggered,
    DateTime GeneratedAtUtc
);

public record SleepReportMetrics(
    int TotalSleepMinutesLogged,
    int NapCountLogged,
    int NightAwakeningsTotal,
    int AverageWakeWindowMinutes
);

public record DiaperReportMetrics(
    int TotalChanges,
    int UrineOrMixedCount,
    int StoolOrMixedCount,
    string PredominantStoolColor,
    string PredominantConsistency
);

public record FeedingReportMetrics(
    int TotalBreastfeedingsLogged,
    int TotalSolidsMealsLogged,
    int HighAcceptanceRatePercent,
    List<string> SafeAllergensCompleted,
    List<string> ActiveAllergenTrials
);
