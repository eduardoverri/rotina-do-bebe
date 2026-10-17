using BabyRoutine.Application.Common.Interfaces;
using BabyRoutine.Application.Common.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BabyRoutine.Infrastructure.Persistence.Repositories;

public class InMemoryDataStore
{
    public List<UserAccount> Users { get; } = [];
    public List<Family> Families { get; } = [];
    public List<Baby> Babies { get; } = [];
    public List<RoutineEvent> RoutineEvents { get; } = [];
    public List<AllergenTrial> AllergenTrials { get; } = [];
    public List<MilestoneProgress> Milestones { get; } = [];
    public object SyncRoot { get; } = new();
}

public class UserRepository(MongoDbContext db, InMemoryDataStore mem) : IUserRepository
{
    public async Task<UserAccount?> GetByIdAsync(string userId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId)) return null;

        if (db.IsMongoConnected && db.Users != null)
        {
            var user = await db.Users.Find(u => u.Id == userId).FirstOrDefaultAsync(ct);
            if (user != null) return user;
        }
        lock (mem.SyncRoot)
        {
            return mem.Users.FirstOrDefault(u => u.Id == userId);
        }
    }

    public async Task<UserAccount?> GetByGoogleSubOrEmailAsync(string googleSub, string email, CancellationToken ct = default)
    {
        var normEmail = email.Trim().ToLowerInvariant();
        if (db.IsMongoConnected && db.Users != null)
        {
            var user = await db.Users.Find(u => u.GoogleSub == googleSub || u.Email.ToLower() == normEmail).FirstOrDefaultAsync(ct);
            if (user != null) return user;
        }
        lock (mem.SyncRoot)
        {
            return mem.Users.FirstOrDefault(u =>
                (!string.IsNullOrWhiteSpace(googleSub) && u.GoogleSub == googleSub) ||
                u.Email.Equals(normEmail, StringComparison.OrdinalIgnoreCase));
        }
    }

    public async Task<UserAccount> UpsertGoogleUserAsync(string googleSub, string email, string name, string pictureUrl, CancellationToken ct = default)
    {
        var existing = await GetByGoogleSubOrEmailAsync(googleSub, email, ct);
        if (existing != null)
        {
            existing.LastLoginAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(name)) existing.Name = name;
            if (!string.IsNullOrWhiteSpace(pictureUrl)) existing.PictureUrl = pictureUrl;
            if (!string.IsNullOrWhiteSpace(googleSub)) existing.GoogleSub = googleSub;

            if (db.IsMongoConnected && db.Users != null)
            {
                await db.Users.ReplaceOneAsync(u => u.Id == existing.Id, existing, new ReplaceOptions { IsUpsert = true }, ct);
            }
            return existing;
        }

        var newUser = new UserAccount
        {
            Id = ObjectId.GenerateNewId().ToString(),
            GoogleSub = string.IsNullOrWhiteSpace(googleSub) ? $"google-{Guid.NewGuid():N}" : googleSub,
            Email = email.Trim().ToLowerInvariant(),
            Name = string.IsNullOrWhiteSpace(name) ? email.Split('@')[0] : name,
            PictureUrl = pictureUrl ?? string.Empty,
            Relation = "Responsável",
            FamilyId = ObjectId.GenerateNewId().ToString(),
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow
        };

        if (db.IsMongoConnected && db.Users != null)
        {
            await db.Users.InsertOneAsync(newUser, cancellationToken: ct);
        }
        lock (mem.SyncRoot)
        {
            mem.Users.Add(newUser);
        }

        return newUser;
    }

    public Task<List<UserAccount>> GetDemoAccountsAsync(CancellationToken ct = default)
    {
        return Task.FromResult(new List<UserAccount>());
    }
}

public class FamilyRepository(MongoDbContext db, InMemoryDataStore mem) : IFamilyRepository
{
    public async Task<Family> GetOrCreateFamilyForUserAsync(UserAccount user, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Families != null)
        {
            var existing = await db.Families.Find(f => f.OwnerUserId == user.Id || f.Id == user.FamilyId).FirstOrDefaultAsync(ct);
            if (existing != null) return existing;
        }

        Family newFam;
        lock (mem.SyncRoot)
        {
            var fam = mem.Families.FirstOrDefault(f => f.OwnerUserId == user.Id || f.Id == user.FamilyId);
            if (fam != null) return fam;

            var lastName = user.Name.Split(' ').LastOrDefault() ?? user.Name;
            newFam = new Family
            {
                Id = user.FamilyId,
                OwnerUserId = user.Id,
                Name = $"Família {lastName}",
                InviteCode = $"{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                SubscriptionTier = "FamilyPro",
                Members =
                [
                    new FamilyMember
                    {
                        UserId = user.Id,
                        Email = user.Email,
                        Name = user.Name,
                        Role = "Owner",
                        Relation = user.Relation
                    }
                ]
            };
            mem.Families.Add(newFam);
        }

        if (db.IsMongoConnected && db.Families != null)
        {
            await db.Families.InsertOneAsync(newFam, cancellationToken: ct);
        }

        return newFam;
    }
}

public class BabyRepository(MongoDbContext db, InMemoryDataStore mem) : IBabyRepository
{
    public async Task<List<Baby>> GetByOwnerUserIdAsync(string ownerUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(ownerUserId)) return [];

        if (db.IsMongoConnected && db.Babies != null)
        {
            return await db.Babies.Find(b => b.OwnerUserId == ownerUserId).SortBy(b => b.CreatedAt).ToListAsync(ct);
        }
        lock (mem.SyncRoot)
        {
            return mem.Babies.Where(b => b.OwnerUserId == ownerUserId).OrderBy(b => b.CreatedAt).ToList();
        }
    }

    public async Task<List<Baby>> GetAllAsync(CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Babies != null)
        {
            return await db.Babies.Find(_ => true).ToListAsync(ct);
        }
        lock (mem.SyncRoot)
        {
            return mem.Babies.ToList();
        }
    }

    public async Task<Baby?> GetByIdAndUserAsync(string babyId, string ownerUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(babyId) || string.IsNullOrWhiteSpace(ownerUserId)) return null;

        if (db.IsMongoConnected && db.Babies != null)
        {
            var baby = await db.Babies.Find(b => b.Id == babyId && b.OwnerUserId == ownerUserId).FirstOrDefaultAsync(ct);
            if (baby != null) return baby;
        }
        lock (mem.SyncRoot)
        {
            return mem.Babies.FirstOrDefault(b => b.Id == babyId && b.OwnerUserId == ownerUserId);
        }
    }

    public async Task<Baby?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Babies != null)
        {
            var baby = await db.Babies.Find(b => b.Id == id).FirstOrDefaultAsync(ct);
            if (baby != null) return baby;
        }
        lock (mem.SyncRoot)
        {
            return mem.Babies.FirstOrDefault(b => b.Id == id);
        }
    }

    public async Task<Baby> InsertAsync(Baby baby, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Babies != null)
        {
            await db.Babies.InsertOneAsync(baby, cancellationToken: ct);
        }
        lock (mem.SyncRoot)
        {
            mem.Babies.Add(baby);
        }
        return baby;
    }

    public async Task UpdateAsync(Baby baby, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Babies != null)
        {
            await db.Babies.ReplaceOneAsync(b => b.Id == baby.Id && b.OwnerUserId == baby.OwnerUserId, baby, new ReplaceOptions { IsUpsert = true }, ct);
        }
        lock (mem.SyncRoot)
        {
            var idx = mem.Babies.FindIndex(b => b.Id == baby.Id && b.OwnerUserId == baby.OwnerUserId);
            if (idx >= 0) mem.Babies[idx] = baby;
        }
    }

    public async Task DeleteAsync(string babyId, string ownerUserId, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Babies != null)
        {
            await db.Babies.DeleteOneAsync(b => b.Id == babyId && b.OwnerUserId == ownerUserId, ct);
            if (db.RoutineEvents != null)
                await db.RoutineEvents.DeleteManyAsync(e => e.BabyId == babyId && e.OwnerUserId == ownerUserId, ct);
            if (db.AllergenTrials != null)
                await db.AllergenTrials.DeleteManyAsync(a => a.BabyId == babyId && a.OwnerUserId == ownerUserId, ct);
            if (db.Milestones != null)
                await db.Milestones.DeleteManyAsync(m => m.BabyId == babyId && m.OwnerUserId == ownerUserId, ct);
        }
        lock (mem.SyncRoot)
        {
            mem.Babies.RemoveAll(b => b.Id == babyId && b.OwnerUserId == ownerUserId);
            mem.RoutineEvents.RemoveAll(e => e.BabyId == babyId && e.OwnerUserId == ownerUserId);
            mem.AllergenTrials.RemoveAll(a => a.BabyId == babyId && a.OwnerUserId == ownerUserId);
            mem.Milestones.RemoveAll(m => m.BabyId == babyId && m.OwnerUserId == ownerUserId);
        }
    }
}

public class RoutineEventRepository(MongoDbContext db, InMemoryDataStore mem) : IRoutineEventRepository
{
    public async Task<RoutineEvent> InsertAsync(RoutineEvent routineEvent, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.RoutineEvents != null)
        {
            await db.RoutineEvents.InsertOneAsync(routineEvent, cancellationToken: ct);
        }
        lock (mem.SyncRoot)
        {
            mem.RoutineEvents.Add(routineEvent);
        }
        return routineEvent;
    }

    public async Task<List<RoutineEvent>> GetByBabyAndDateRangeAsync(string ownerUserId, string babyId, DateTime startUtc, DateTime endUtc, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.RoutineEvents != null)
        {
            return await db.RoutineEvents
                .Find(e => e.OwnerUserId == ownerUserId && e.BabyId == babyId && e.Timestamp >= startUtc && e.Timestamp <= endUtc)
                .SortByDescending(e => e.Timestamp)
                .ToListAsync(ct);
        }

        lock (mem.SyncRoot)
        {
            return mem.RoutineEvents
                .Where(e => e.OwnerUserId == ownerUserId && e.BabyId == babyId && e.Timestamp >= startUtc && e.Timestamp <= endUtc)
                .OrderByDescending(e => e.Timestamp)
                .ToList();
        }
    }

    public async Task<List<RoutineEvent>> GetRecentByBabyAsync(string ownerUserId, string babyId, int limit = 50, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.RoutineEvents != null)
        {
            return await db.RoutineEvents
                .Find(e => e.OwnerUserId == ownerUserId && e.BabyId == babyId)
                .SortByDescending(e => e.Timestamp)
                .Limit(limit)
                .ToListAsync(ct);
        }

        lock (mem.SyncRoot)
        {
            return mem.RoutineEvents
                .Where(e => e.OwnerUserId == ownerUserId && e.BabyId == babyId)
                .OrderByDescending(e => e.Timestamp)
                .Take(limit)
                .ToList();
        }
    }

    public async Task<RoutineEvent?> GetLastEventByCategoryAsync(string ownerUserId, string babyId, string category, CancellationToken ct = default)
    {
        var recent = await GetRecentByBabyAsync(ownerUserId, babyId, 100, ct);
        return recent.FirstOrDefault(e => e.Category.Equals(category, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<RoutineEvent?> GetLastMedicationEventAsync(string ownerUserId, string babyId, string medicationName, CancellationToken ct = default)
    {
        var recent = await GetRecentByBabyAsync(ownerUserId, babyId, 100, ct);
        var key = medicationName.Split(' ')[0].ToLowerInvariant();
        return recent.FirstOrDefault(e =>
            e.Category == RoutineCategory.Medication &&
            (e.Details.MedicationName ?? string.Empty).ToLowerInvariant().Contains(key));
    }
}

public class AllergenTrialRepository(MongoDbContext db, InMemoryDataStore mem) : IAllergenTrialRepository
{
    public async Task<List<AllergenTrial>> GetByBabyIdAsync(string ownerUserId, string babyId, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.AllergenTrials != null)
        {
            return await db.AllergenTrials
                .Find(a => a.OwnerUserId == ownerUserId && a.BabyId == babyId)
                .SortByDescending(a => a.IntroducedAt)
                .ToListAsync(ct);
        }
        lock (mem.SyncRoot)
        {
            return mem.AllergenTrials
                .Where(a => a.OwnerUserId == ownerUserId && a.BabyId == babyId)
                .OrderByDescending(a => a.IntroducedAt)
                .ToList();
        }
    }

    public async Task<AllergenTrial?> GetByIdAsync(string ownerUserId, string id, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.AllergenTrials != null)
        {
            return await db.AllergenTrials.Find(a => a.Id == id && a.OwnerUserId == ownerUserId).FirstOrDefaultAsync(ct);
        }
        lock (mem.SyncRoot)
        {
            return mem.AllergenTrials.FirstOrDefault(a => a.Id == id && a.OwnerUserId == ownerUserId);
        }
    }

    public async Task<AllergenTrial> InsertAsync(AllergenTrial trial, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.AllergenTrials != null)
        {
            await db.AllergenTrials.InsertOneAsync(trial, cancellationToken: ct);
        }
        lock (mem.SyncRoot)
        {
            mem.AllergenTrials.Insert(0, trial);
        }
        return trial;
    }

    public async Task UpdateAsync(AllergenTrial trial, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.AllergenTrials != null)
        {
            await db.AllergenTrials.ReplaceOneAsync(a => a.Id == trial.Id && a.OwnerUserId == trial.OwnerUserId, trial, new ReplaceOptions { IsUpsert = true }, ct);
        }
        lock (mem.SyncRoot)
        {
            var idx = mem.AllergenTrials.FindIndex(a => a.Id == trial.Id && a.OwnerUserId == trial.OwnerUserId);
            if (idx >= 0) mem.AllergenTrials[idx] = trial;
        }
    }
}

public class MilestoneRepository(MongoDbContext db, InMemoryDataStore mem) : IMilestoneRepository
{
    public async Task<List<MilestoneProgress>> GetByBabyIdAsync(string ownerUserId, string babyId, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Milestones != null)
        {
            var list = await db.Milestones.Find(m => m.OwnerUserId == ownerUserId && m.BabyId == babyId).SortBy(m => m.ExpectedAgeMonths).ToListAsync(ct);
            if (list.Count > 0) return list;

            var initial = SeedData.CreateInitialMilestones(babyId, ownerUserId);
            await db.Milestones.InsertManyAsync(initial, cancellationToken: ct);
            return initial;
        }
        lock (mem.SyncRoot)
        {
            var babyMilestones = mem.Milestones
                .Where(m => m.OwnerUserId == ownerUserId && m.BabyId == babyId)
                .OrderBy(m => m.ExpectedAgeMonths)
                .ToList();
            if (babyMilestones.Count == 0)
            {
                var seeded = SeedData.CreateInitialMilestones(babyId, ownerUserId);
                mem.Milestones.AddRange(seeded);
                return seeded;
            }
            return babyMilestones;
        }
    }

    public async Task<MilestoneProgress?> GetByCodeAsync(string ownerUserId, string babyId, string milestoneCode, CancellationToken ct = default)
    {
        var all = await GetByBabyIdAsync(ownerUserId, babyId, ct);
        return all.FirstOrDefault(m => m.MilestoneCode.Equals(milestoneCode, StringComparison.OrdinalIgnoreCase));
    }

    public async Task UpdateAsync(MilestoneProgress milestone, CancellationToken ct = default)
    {
        if (db.IsMongoConnected && db.Milestones != null)
        {
            await db.Milestones.ReplaceOneAsync(m => m.Id == milestone.Id && m.OwnerUserId == milestone.OwnerUserId, milestone, new ReplaceOptions { IsUpsert = true }, ct);
        }
        lock (mem.SyncRoot)
        {
            var idx = mem.Milestones.FindIndex(m => m.Id == milestone.Id && m.OwnerUserId == milestone.OwnerUserId);
            if (idx >= 0) mem.Milestones[idx] = milestone;
        }
    }
}
