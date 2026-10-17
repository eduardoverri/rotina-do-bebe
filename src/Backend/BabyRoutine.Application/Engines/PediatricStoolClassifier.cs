namespace BabyRoutine.Application.Engines;

public class PediatricStoolClassifier
{
    public static (bool IsClinicalAlert, string? AlertMessage, string UrgencyLevel) Evaluate(
        string? color,
        string? consistency,
        bool hasBlood,
        int babyAgeDays)
    {
        var normalizedColor = color ?? string.Empty;
        var normalizedConsistency = consistency ?? string.Empty;

        if (normalizedColor.Equals("WhiteGrey", StringComparison.OrdinalIgnoreCase))
        {
            return (
                true,
                "EMERGÊNCIA PEDIÁTRICA: Fezes brancas/acinzentadas (acolia fecal). Procure o pronto-atendimento imediatamente para investigar vias biliares.",
                "Emergency"
            );
        }

        if (normalizedColor.Equals("Black", StringComparison.OrdinalIgnoreCase) && babyAgeDays > 5)
        {
            return (
                true,
                "ALERTA URGENTE: Fezes pretas (melena) após o período neonatal podem indicar sangramento digestivo alto.",
                "Urgent"
            );
        }

        if (hasBlood || normalizedColor.Equals("RedBlood", StringComparison.OrdinalIgnoreCase))
        {
            return (
                true,
                "AVISO PEDIÁTRICO: Presença de sangue vivo nas fezes. Fotografe e consulte o pediatra para investigar APLV (Alergia à Proteína do Leite de Vaca) ou fissuras.",
                "HighPriority"
            );
        }

        if (normalizedConsistency.Equals("Hardened", StringComparison.OrdinalIgnoreCase))
        {
            return (
                true,
                "ATENÇÃO: Fezes ressecadas/endurecidas (sinal de constipação). Avalie oferta hídrica e fibras solúveis/insolúveis na introdução alimentar.",
                "HighPriority"
            );
        }

        return (false, null, "Normal");
    }

    public static (bool IsLowHydrationAlert, string StatusMessage, int ExpectedMinimumChanges) EvaluateDailyDiaperFrequency(
        int babyAgeMonths,
        int dailyTotalChanges,
        int dailyUrineOrMixedCount)
    {
        int expectedMin = babyAgeMonths < 6 ? 8 : 6;
        int criticalUrineThreshold = babyAgeMonths < 6 ? 6 : 4;

        if (dailyUrineOrMixedCount < criticalUrineThreshold)
        {
            return (
                true,
                $"Atenção à hidratação: Apenas {dailyUrineOrMixedCount} fraldas com urina hoje (esperado mínimo de {criticalUrineThreshold} para a faixa etária).",
                expectedMin
            );
        }

        return (
            false,
            $"Hidratação adequada ({dailyUrineOrMixedCount} fraldas úmidas / {dailyTotalChanges} trocas totais no dia; referência: {expectedMin} trocas/dia).",
            expectedMin
        );
    }
}
