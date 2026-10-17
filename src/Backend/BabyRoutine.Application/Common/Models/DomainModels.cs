using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BabyRoutine.Application.Common.Models;

public class UserAccount
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string GoogleSub { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PictureUrl { get; set; } = string.Empty;
    public string Relation { get; set; } = "Mãe/Pai";
    public string FamilyId { get; set; } = ObjectId.GenerateNewId().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;
}

public class Family
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string OwnerUserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string InviteCode { get; set; } = string.Empty;
    public string SubscriptionTier { get; set; } = "FamilyPro";
    public List<FamilyMember> Members { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class FamilyMember
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = "Owner"; // Owner, Caregiver, Medical
    public string Relation { get; set; } = "Mãe";
    public NotificationPreferences NotificationPreferences { get; set; } = new();
}

public class NotificationPreferences
{
    public bool PushEnabled { get; set; } = true;
    public bool NightModeAlerts { get; set; } = false;
}

public class Baby
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string OwnerUserId { get; set; } = string.Empty;
    public string FamilyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime BirthDate { get; set; }
    public int GestationalWeeks { get; set; } = 39;
    public int GestationalDays { get; set; } = 0;
    public string Gender { get; set; } = "M";
    public double BirthWeightGrams { get; set; }
    public double BirthLengthCm { get; set; }
    public double CurrentWeightGrams { get; set; }
    public double CurrentHeightCm { get; set; }
    public double HeadCircumferenceCm { get; set; }
    public string BloodType { get; set; } = "O+";
    public PediatricianInfo Pediatrician { get; set; } = new();
    public List<ActiveMedication> ActiveMedications { get; set; } = [];
    public List<string> Allergies { get; set; } = [];
    public List<GrowthLog> GrowthLogs { get; set; } = [];
    public List<VaccineRecord> Vaccines { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int GetChronologicalAgeDays(DateTime? referenceDate = null)
    {
        var now = referenceDate ?? DateTime.UtcNow;
        return Math.Max(0, (int)(now - BirthDate).TotalDays);
    }

    public int GetChronologicalAgeMonths(DateTime? referenceDate = null)
    {
        return GetChronologicalAgeDays(referenceDate) / 30;
    }

    public int GetCorrectedAgeDays(DateTime? referenceDate = null)
    {
        var chronoDays = GetChronologicalAgeDays(referenceDate);
        if (GestationalWeeks >= 37) return chronoDays;
        var prematureDays = ((40 * 7) - (GestationalWeeks * 7 + GestationalDays));
        return Math.Max(0, chronoDays - prematureDays);
    }

    public int GetEffectiveAgeMonthsForDevelopment(DateTime? referenceDate = null)
    {
        return GetCorrectedAgeDays(referenceDate) / 30;
    }
}

public class PediatricianInfo
{
    public string Name { get; set; } = string.Empty;
    public string Crm { get; set; } = string.Empty;
    public string EmergencyPhone { get; set; } = string.Empty;
}

public class ActiveMedication
{
    public string Name { get; set; } = string.Empty;
    public string Dose { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public bool IsContinuous { get; set; } = true;
}

public class GrowthLog
{
    public DateTime MeasuredAt { get; set; }
    public double WeightGrams { get; set; }
    public double HeightCm { get; set; }
    public double HeadCircumferenceCm { get; set; }
    public double ZScoreWeightForAge { get; set; }
}

public class VaccineRecord
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int RecommendedMonth { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Applied, Overdue
    public DateTime? AppliedAt { get; set; }
}

public static class RoutineCategory
{
    public const string Diaper = "Diaper";
    public const string Sleep = "Sleep";
    public const string Feeding = "Feeding";
    public const string Medication = "Medication";
    public const string Bath = "Bath";
    public const string WakeUp = "WakeUp";
}

public class RoutineEvent
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string OwnerUserId { get; set; } = string.Empty;
    public string BabyId { get; set; } = string.Empty;
    public string FamilyId { get; set; } = string.Empty;
    public string RecordedByUserId { get; set; } = string.Empty;
    public string RecordedByName { get; set; } = "Mãe";
    public string Category { get; set; } = RoutineCategory.Feeding;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public DateTime? EndTimestamp { get; set; }
    public int? DurationMinutes { get; set; }
    public RoutineEventDetails Details { get; set; } = new();
    public ClinicalFlags ClinicalFlags { get; set; } = new();
    public string? Notes { get; set; }
}

public class RoutineEventDetails
{
    // Diaper fields (Seção 4.1)
    public string? State { get; set; } // L = Limpa, U = Urina, E = Evacuação, M = Mista
    public int? VolumeLevel { get; set; } // 1 = Baixo, 2 = Médio, 3 = Alto
    public string? StoolConsistency { get; set; } // LiquidPastous, MoldedPastous, Hardened
    public string? StoolColor { get; set; } // Mustard, BrownishGreen, WhiteGrey, Black, RedBlood
    public bool HasMucus { get; set; }
    public bool HasBlood { get; set; }
    public bool BarrierCreamApplied { get; set; }

    // Sleep fields (Seção 3)
    public string? SleepType { get; set; } // Nap, NightSleep
    public int? WakeWindowPrecedingMinutes { get; set; }
    public string? SleepLocation { get; set; } // Crib, Lap, Stroller, CoSleeping
    public string? FallingAsleepMethod { get; set; }
    public string? SleepQuality { get; set; } // Restless, Good, Interrupted
    public int AwakeningsCount { get; set; }
    public List<string> ReinductionMethods { get; set; } = [];
    public bool HadResistance { get; set; }

    // Feeding fields (Seção 2)
    public string? FeedingType { get; set; } // Breast, Formula, ExpressedMilk, Solids
    public BreastfeedingDetails? BreastfeedingDetails { get; set; }
    public SolidsDetails? SolidsDetails { get; set; }
    public int? FormulaVolumeMl { get; set; }

    // Medication fields (Seção 1.2)
    public string? MedicationName { get; set; }
    public string? DosageGiven { get; set; }
    public double? DosageMg { get; set; }
    public double? BabyWeightAtTimeKg { get; set; }
    public string? Reason { get; set; }
    public double? MeasuredTemperatureCelsius { get; set; }
    public int? MinimumIntervalHours { get; set; }
    public DateTime? NextAllowedDoseAt { get; set; }
}

public class BreastfeedingDetails
{
    public string LastSideOffered { get; set; } = "Left"; // Left, Right, Both
    public int LeftDurationSeconds { get; set; }
    public int RightDurationSeconds { get; set; }
    public string? HungerCueStage { get; set; } // Early, Intermediate, Late
    public List<string> SatietyCues { get; set; } = [];
}

public class SolidsDetails
{
    public string MealType { get; set; } = "Lunch"; // Breakfast, MorningSnack, Lunch, AfternoonSnack, Dinner
    public FoodGroups FoodGroups { get; set; } = new();
    public string AcceptanceLevel { get; set; } = "High"; // Refused, Low, Medium, High
    public List<string> AllergensPresented { get; set; } = [];
    public string EatingAutonomy { get; set; } = "Mixed"; // PureeSpoon, BLW, BLW_Assisted, Mixed, FamilyTable
    public string? HungerCuesNoticed { get; set; }
    public string? SatietyCuesNoticed { get; set; }
}

public class FoodGroups
{
    public List<string> FruitsAndVegetables { get; set; } = [];
    public List<string> CerealsAndTubers { get; set; } = [];
    public List<string> Legumes { get; set; } = [];
    public List<string> AnimalProtein { get; set; } = [];
}

public class ClinicalFlags
{
    public bool IsRedFlagAlert { get; set; }
    public string? AlertMessage { get; set; }
    public string UrgencyLevel { get; set; } = "Normal"; // Normal, HighPriority, Urgent, Emergency
}

public class AllergenTrial
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string OwnerUserId { get; set; } = string.Empty;
    public string BabyId { get; set; } = string.Empty;
    public string FoodName { get; set; } = string.Empty;
    public string FoodCategory { get; set; } = "Alérgeno Principal";
    public DateTime IntroducedAt { get; set; } = DateTime.UtcNow;
    public DateTime MonitoringEndsAt { get; set; } = DateTime.UtcNow.AddHours(72);
    public string Status { get; set; } = "MonitoringActive"; // MonitoringActive, ReactionReported, SafeCompleted
    public List<ExposureDose> ExposureDoses { get; set; } = [];
    public SymptomsChecklist SymptomsChecklist { get; set; } = new();
    public string? PediatricianNotes { get; set; }
}

public class ExposureDose
{
    public int Day { get; set; }
    public string QuantityOffered { get; set; } = string.Empty;
    public bool ReactionObserved { get; set; }
}

public class SymptomsChecklist
{
    public bool HivesOrRash { get; set; }
    public bool FacialSwelling { get; set; }
    public bool AcuteVomiting { get; set; }
    public bool ExplosiveDiarrhea { get; set; }
    public bool Wheezing { get; set; }

    public bool HasAnySymptom =>
        HivesOrRash || FacialSwelling || AcuteVomiting || ExplosiveDiarrhea || Wheezing;
}

public class MilestoneProgress
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string OwnerUserId { get; set; } = string.Empty;
    public string BabyId { get; set; } = string.Empty;
    public string MilestoneCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DirectionType { get; set; } = "Cephalocaudal"; // Cephalocaudal, Proximodistal
    public int ExpectedAgeMonths { get; set; }
    public string AgeRangeLabel { get; set; } = string.Empty;
    public string Status { get; set; } = "NotStarted"; // NotStarted, InProgress, Achieved
    public DateTime? AchievedAtDate { get; set; }
    public int? ActualAgeAtAchievementDays { get; set; }
    public string? MediaPhotoUrl { get; set; }
    public string? Notes { get; set; }
}
