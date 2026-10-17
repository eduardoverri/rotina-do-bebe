using BabyRoutine.Application.Common.Models;

namespace BabyRoutine.Application.Features.Feeding;

public record QuickBreastfeedingDto(
    string Side, // "L" / "Left" or "R" / "Right" or "Both"
    int LeftDurationSeconds,
    int RightDurationSeconds,
    string? HungerCueStage,
    List<string>? SatietyCues,
    string? Notes
);

public record SolidsPlateDto(
    string MealType, // Breakfast, MorningSnack, Lunch, AfternoonSnack, Dinner
    List<string> FruitsAndVegetables,
    List<string> CerealsAndTubers,
    List<string> Legumes,
    List<string> AnimalProtein,
    string AcceptanceLevel, // Refused, Low, Medium, High
    string EatingAutonomy, // PureeSpoon, BLW, BLW_Assisted, Mixed, FamilyTable
    List<string>? AllergensPresented,
    string? Notes
);

public record RegisterAllergenTrialDto(
    string FoodName,
    string FoodCategory,
    string? InitialQuantityOffered,
    string? Notes
);

public record UpdateAllergenTrialSymptomsDto(
    bool HivesOrRash,
    bool FacialSwelling,
    bool AcuteVomiting,
    bool ExplosiveDiarrhea,
    bool Wheezing,
    int? ExposureDay,
    string? QuantityOffered,
    string? PediatricianNotes
);

public record HungerAndSatietyGuideDto(
    List<string> EarlyHungerCues,
    List<string> IntermediateHungerCues,
    List<string> LateHungerCues,
    string LateHungerConduct,
    List<string> SatietyMarkers
)
{
    public static HungerAndSatietyGuideDto Default => new(
        EarlyHungerCues:
        [
            "Movimentação corporal sutil",
            "Abertura espontânea da boca",
            "Reflexo de busca (virar o rosto contra superfícies)",
            "Levar as mãos ou dedos à boca"
        ],
        IntermediateHungerCues:
        [
            "Espreguiçar acentuado",
            "Movimentos ativos de sucção dos lábios ou língua",
            "Pequenos sons e resmungos de desconforto"
        ],
        LateHungerCues:
        [
            "Choro forte e inconsolável",
            "Agitação corporal motora intensa e rubor facial"
        ],
        LateHungerConduct: "Acalmar o bebê no colo e regular a respiração antes de acoplar ao seio ou bico.",
        SatietyMarkers:
        [
            "Diminuição gradual da frequência e força da sucção",
            "Desprendimento espontâneo da mama ou bico",
            "Relaxamento muscular periférico (mãos cerradas se abrem, braços/pernas soltos)",
            "Fechamento firme dos lábios ou virar a face ao reapresentar alimento",
            "Entrada em estado de sonolência ou satisfação tranquila"
        ]
    );
}
