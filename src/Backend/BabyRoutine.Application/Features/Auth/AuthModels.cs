namespace BabyRoutine.Application.Features.Auth;

public record GoogleLoginRequestDto(
    string? IdToken = null,
    string? AccessToken = null,
    string? AuthorizationCode = null,
    string? RedirectUri = null
);

public record GoogleSsoClientConfigDto(string ClientId);

public record GoogleSsoPayload(
    string GoogleSub,
    string Email,
    bool EmailVerified,
    string Name,
    string PictureUrl
);

public interface IGoogleSsoValidator
{
    Task<GoogleSsoPayload> ValidateAsync(GoogleLoginRequestDto dto, CancellationToken ct = default);
}

public record CreateChildRequestDto(
    string Name,
    DateTime BirthDate,
    int GestationalWeeks = 39,
    int GestationalDays = 0,
    string Gender = "M",
    double BirthWeightGrams = 3200,
    double BirthLengthCm = 49.0,
    double CurrentWeightGrams = 5500,
    double CurrentHeightCm = 58.0,
    double HeadCircumferenceCm = 39.0,
    string BloodType = "O+",
    string? PediatricianName = null,
    string? PediatricianCrm = null,
    string? PediatricianPhone = null
);

public record RestoreUserStateRequestDto(
    List<BabyRoutine.Application.Common.Models.Baby>? Babies = null,
    List<BabyRoutine.Application.Common.Models.RoutineEvent>? RoutineEvents = null,
    List<BabyRoutine.Application.Common.Models.AllergenTrial>? AllergenTrials = null,
    List<BabyRoutine.Application.Common.Models.MilestoneProgress>? Milestones = null
);
