namespace BabyRoutine.Application.Features.Health;

public record AdministerMedicationDto(
    string MedicationName,
    double DoseMg,
    string? DosageGiven,
    double? MeasuredTemperatureCelsius,
    string? Reason,
    string? Notes
);

public record ToggleMilestoneDto(
    string Status, // NotStarted, InProgress, Achieved
    string? Notes,
    string? MediaPhotoUrl
);
