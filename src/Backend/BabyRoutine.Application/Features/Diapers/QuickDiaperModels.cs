namespace BabyRoutine.Application.Features.Diapers;

public record QuickDiaperDto(
    string Code, // e.g., "L", "U1", "U2", "U3", "E1", "E2", "E3", "M1", "M2", "M3" or state "U","E","M","L"
    int? VolumeLevel,
    string? StoolColor, // Mustard, BrownishGreen, WhiteGrey, Black, RedBlood
    string? StoolConsistency, // LiquidPastous, MoldedPastous, Hardened
    bool HasMucus = false,
    bool HasBlood = false,
    bool BarrierCreamApplied = true,
    string? Notes = null
);
