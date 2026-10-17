using BabyRoutine.Application.Common.Models;

namespace BabyRoutine.Application.Common.Interfaces;

public interface IUserRepository
{
    Task<UserAccount?> GetByIdAsync(string userId, CancellationToken ct = default);
    Task<UserAccount?> GetByGoogleSubOrEmailAsync(string googleSub, string email, CancellationToken ct = default);
    Task<UserAccount> UpsertGoogleUserAsync(string googleSub, string email, string name, string pictureUrl, CancellationToken ct = default);
    Task<List<UserAccount>> GetDemoAccountsAsync(CancellationToken ct = default);
}

public interface IBabyRepository
{
    Task<List<Baby>> GetByOwnerUserIdAsync(string ownerUserId, CancellationToken ct = default);
    Task<List<Baby>> GetAllAsync(CancellationToken ct = default);
    Task<Baby?> GetByIdAndUserAsync(string babyId, string ownerUserId, CancellationToken ct = default);
    Task<Baby?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Baby> InsertAsync(Baby baby, CancellationToken ct = default);
    Task UpdateAsync(Baby baby, CancellationToken ct = default);
    Task DeleteAsync(string babyId, string ownerUserId, CancellationToken ct = default);
}

public interface IRoutineEventRepository
{
    Task<RoutineEvent> InsertAsync(RoutineEvent routineEvent, CancellationToken ct = default);
    Task<List<RoutineEvent>> GetByBabyAndDateRangeAsync(string ownerUserId, string babyId, DateTime startUtc, DateTime endUtc, CancellationToken ct = default);
    Task<List<RoutineEvent>> GetRecentByBabyAsync(string ownerUserId, string babyId, int limit = 50, CancellationToken ct = default);
    Task<RoutineEvent?> GetLastEventByCategoryAsync(string ownerUserId, string babyId, string category, CancellationToken ct = default);
    Task<RoutineEvent?> GetLastMedicationEventAsync(string ownerUserId, string babyId, string medicationName, CancellationToken ct = default);
}

public interface IAllergenTrialRepository
{
    Task<List<AllergenTrial>> GetByBabyIdAsync(string ownerUserId, string babyId, CancellationToken ct = default);
    Task<AllergenTrial?> GetByIdAsync(string ownerUserId, string id, CancellationToken ct = default);
    Task<AllergenTrial> InsertAsync(AllergenTrial trial, CancellationToken ct = default);
    Task UpdateAsync(AllergenTrial trial, CancellationToken ct = default);
}

public interface IMilestoneRepository
{
    Task<List<MilestoneProgress>> GetByBabyIdAsync(string ownerUserId, string babyId, CancellationToken ct = default);
    Task<MilestoneProgress?> GetByCodeAsync(string ownerUserId, string babyId, string milestoneCode, CancellationToken ct = default);
    Task UpdateAsync(MilestoneProgress milestone, CancellationToken ct = default);
}

public interface IFamilyRepository
{
    Task<Family> GetOrCreateFamilyForUserAsync(UserAccount user, CancellationToken ct = default);
}
