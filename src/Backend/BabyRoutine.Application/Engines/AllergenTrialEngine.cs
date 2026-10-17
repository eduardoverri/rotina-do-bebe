using BabyRoutine.Application.Common.Models;

namespace BabyRoutine.Application.Engines;

public class AllergenTrialEngine
{
    public record AllergenTrialEvaluation(
        string Status,
        double RemainingHours,
        bool HasAlertSymptoms,
        string ClinicalGuidance
    );

    public static AllergenTrialEvaluation EvaluateTrial(AllergenTrial trial, DateTime? referenceUtc = null)
    {
        var now = referenceUtc ?? DateTime.UtcNow;
        var remainingHours = Math.Max(0, Math.Round((trial.MonitoringEndsAt - now).TotalHours, 1));

        if (trial.SymptomsChecklist.HasAnySymptom)
        {
            var activeSymptoms = new List<string>();
            if (trial.SymptomsChecklist.HivesOrRash) activeSymptoms.Add("Urticária/Placas avermelhadas");
            if (trial.SymptomsChecklist.FacialSwelling) activeSymptoms.Add("Inchaço em lábios/olhos");
            if (trial.SymptomsChecklist.AcuteVomiting) activeSymptoms.Add("Vômitos agudos");
            if (trial.SymptomsChecklist.ExplosiveDiarrhea) activeSymptoms.Add("Diarreia explosiva");
            if (trial.SymptomsChecklist.Wheezing) activeSymptoms.Add("Chiado no peito");

            var isSevere = trial.SymptomsChecklist.FacialSwelling || trial.SymptomsChecklist.Wheezing || trial.SymptomsChecklist.AcuteVomiting;

            return new AllergenTrialEvaluation(
                Status: "ReactionReported",
                RemainingHours: remainingHours,
                HasAlertSymptoms: true,
                ClinicalGuidance: isSevere
                    ? $"ALERTA DE REAÇÃO ALÉRGICA AGUDA ({string.Join(", ", activeSymptoms)}): Suspenda imediatamente a oferta de '{trial.FoodName}' e procure avaliação médica de urgência."
                    : $"Sinais cutâneos/gastrointestinais observados ({string.Join(", ", activeSymptoms)}). Suspenda a oferta de '{trial.FoodName}', fotografe as lesões e comunique o pediatra."
            );
        }

        if (now >= trial.MonitoringEndsAt)
        {
            return new AllergenTrialEvaluation(
                Status: "SafeCompleted",
                RemainingHours: 0,
                HasAlertSymptoms: false,
                ClinicalGuidance: $"Janela de 72 horas concluída sem reações adversas! '{trial.FoodName}' pode ser integrado ao cardápio rotineiro da família."
            );
        }

        return new AllergenTrialEvaluation(
            Status: "MonitoringActive",
            RemainingHours: remainingHours,
            HasAlertSymptoms: false,
            ClinicalGuidance: $"Vigilância ativa de 72h em andamento ({remainingHours:F0}h restantes). Não introduza nenhum outro alérgeno inédito neste período."
        );
    }
}
