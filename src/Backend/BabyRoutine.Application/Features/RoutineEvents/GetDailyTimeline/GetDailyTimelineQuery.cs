using BabyRoutine.Application.Common.Models;

namespace BabyRoutine.Application.Features.RoutineEvents.GetDailyTimeline;

public record DailyTimelineResponse(
    string BabyId,
    string Date,
    int TotalEvents,
    int TotalSleepMinutes,
    int NapCount,
    int ExpectedNaps,
    int TotalDiaperChanges,
    int UrineOrMixedCount,
    int StoolOrMixedCount,
    bool IsLowHydrationAlert,
    string HydrationStatusMessage,
    string LastFeedingSummary,
    string LastDiaperSummary,
    List<RoutineEvent> Events
);
