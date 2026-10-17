using BabyRoutine.Application.Common.Interfaces;
using BabyRoutine.Application.Engines;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BabyRoutine.Infrastructure.BackgroundJobs;

public class MedicationReminderJob(
    IServiceScopeFactory scopeFactory,
    ILogger<MedicationReminderJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("MedicationReminderJob & AllergenWatcher started.");

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var babyRepo = scope.ServiceProvider.GetRequiredService<IBabyRepository>();
                var allergenRepo = scope.ServiceProvider.GetRequiredService<IAllergenTrialRepository>();

                var babies = await babyRepo.GetAllAsync(stoppingToken);
                foreach (var baby in babies)
                {
                    var trials = await allergenRepo.GetByBabyIdAsync(baby.OwnerUserId, baby.Id, stoppingToken);
                    foreach (var trial in trials.Where(t => t.Status == "MonitoringActive"))
                    {
                        var eval = AllergenTrialEngine.EvaluateTrial(trial);
                        if (eval.Status != trial.Status)
                        {
                            trial.Status = eval.Status;
                            await allergenRepo.UpdateAsync(trial, stoppingToken);
                            logger.LogInformation("Updated allergen trial '{FoodName}' for baby '{BabyName}' (User {UserId}) to status {Status}",
                                trial.FoodName, baby.Name, baby.OwnerUserId, trial.Status);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error in MedicationReminderJob tick.");
            }
        }
    }
}
