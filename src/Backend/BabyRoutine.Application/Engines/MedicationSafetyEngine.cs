namespace BabyRoutine.Application.Engines;

public class MedicationSafetyEngine
{
    public record MedicationSafetyResult(
        bool IsSafe,
        string Message,
        DateTime? NextAllowedDose,
        double RecommendedDoseMg,
        double MaxSafeDoseMg,
        int MinimumIntervalHours
    );

    public static MedicationSafetyResult ValidateDose(
        string medicationName,
        double babyWeightKg,
        double doseMg,
        DateTime requestedDoseTime,
        DateTime? lastDoseTime)
    {
        var medLower = (medicationName ?? string.Empty).ToLowerInvariant();

        // 1. Verificação de Intervalo Mínimo (Seção 4.2.2)
        var minIntervalHours = medLower.Contains("ibuprofeno") ? 8 : 6; // Paracetamol / Dipirona = 6h, Ibuprofeno = 8h
        var minInterval = TimeSpan.FromHours(minIntervalHours);

        var maxMgPerKg = medLower.Contains("ibuprofeno") ? 10.0 : 15.0;
        var recommendedMg = Math.Round(babyWeightKg * (medLower.Contains("ibuprofeno") ? 10.0 : 12.5), 1);
        var maxRecommendedMg = Math.Round(babyWeightKg * maxMgPerKg, 1);

        if (lastDoseTime.HasValue)
        {
            var nextAllowed = lastDoseTime.Value + minInterval;
            if (requestedDoseTime < nextAllowed)
            {
                var elapsedMinutes = Math.Max(0, (int)(requestedDoseTime - lastDoseTime.Value).TotalMinutes);
                var remainingMinutes = Math.Max(1, (int)Math.Ceiling((nextAllowed - requestedDoseTime).TotalMinutes));
                return new(
                    false,
                    $"INTERVALO INSUFICIENTE! Última dose há {elapsedMinutes} min. Próxima dose permitida em {remainingMinutes} minutos.",
                    nextAllowed,
                    recommendedMg,
                    maxRecommendedMg,
                    minIntervalHours
                );
            }
        }

        // 2. Validação de Dosagem por Quilo (Tolerância de 10% conforme Design Doc)
        if (doseMg > maxRecommendedMg * 1.1)
        {
            return new(
                false,
                $"ALERTA DE SEGURANÇA: Dose ({doseMg}mg) excede o limite seguro ({maxRecommendedMg:F1}mg) para o peso de {babyWeightKg:F1}kg.",
                null,
                recommendedMg,
                maxRecommendedMg,
                minIntervalHours
            );
        }

        return new(
            true,
            "Dosagem e intervalo validados com sucesso.",
            requestedDoseTime + minInterval,
            recommendedMg,
            maxRecommendedMg,
            minIntervalHours
        );
    }
}
