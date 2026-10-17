using BabyRoutine.Application.Common.Models;

namespace BabyRoutine.Infrastructure.Persistence;

public static class SeedData
{
    public static List<VaccineRecord> CreateDefaultVaccines() =>
    [
        new VaccineRecord { Code = "BCG_HB", Name = "BCG + Hepatite B (Ao nascer)", RecommendedMonth = 0, Status = "Pending" },
        new VaccineRecord { Code = "PENTA_VIP_ROTA_PNEUMO_2M", Name = "Pentavalente + VIP + Rotavírus + Pneumo 10 (1ª dose)", RecommendedMonth = 2, Status = "Pending" },
        new VaccineRecord { Code = "MENINGO_C_ACWY_B_3M", Name = "Meningocócica C/ACWY + Meningo B (1ª dose)", RecommendedMonth = 3, Status = "Pending" },
        new VaccineRecord { Code = "PENTA_VIP_ROTA_PNEUMO_4M", Name = "Pentavalente + VIP + Rotavírus + Pneumo 10 (2ª dose)", RecommendedMonth = 4, Status = "Pending" },
        new VaccineRecord { Code = "PENTA_VIP_INFLUENZA_6M", Name = "Pentavalente (3ª dose) + VIP + Influenza Trivalente", RecommendedMonth = 6, Status = "Pending" },
        new VaccineRecord { Code = "FEBRE_AMARELA_9M", Name = "Febre Amarela (1ª dose)", RecommendedMonth = 9, Status = "Pending" },
        new VaccineRecord { Code = "TRIPLICE_VIRAL_PNEUMO_MENINGO_12M", Name = "Tríplice Viral + Reforço Pneumo 10 + Meningo", RecommendedMonth = 12, Status = "Pending" }
    ];

    public static List<MilestoneProgress> CreateInitialMilestones(string babyId, string ownerUserId)
    {
        var templates = new (string Code, string Title, string Desc, string Dir, int Months, string Range)[]
        {
            ("MOTOR_02_04M_HEAD_CONTROL", "Sustentação firme da cabeça em posição prona (Tummy Time)", "Controle cervical firme elevando cabeça e tórax apoiado nos antebraços.", "Cephalocaudal", 3, "2 a 4 meses"),
            ("MOTOR_02_04M_HANDS_OPEN_REACH", "Abertura das mãos, alcance inicial de objetos e sorriso social", "Fixação visual, sorriso responsivo e abertura espontânea dos punhos para tocar brinquedos.", "Proximodistal", 3, "2 a 4 meses"),
            ("MOTOR_06M_SITTING_MIN_SUPPORT", "Controle de tronco para sentar-se com apoio mínimo", "Prontidão postural essencial para início seguro da introdução alimentar.", "Cephalocaudal", 6, "6 meses"),
            ("MOTOR_06M_BILATERAL_ROLLING", "Rolamento bilateral completo (supino ↔ prono)", "Rola de barriga para cima para barriga para baixo e vice-versa com dissociação de cinturas.", "Cephalocaudal", 6, "6 meses"),
            ("MOTOR_06M_OBJECT_TRANSFER", "Transferência de objetos de uma mão para a outra", "Coordenação bimanual na linha média.", "Proximodistal", 6, "6 meses"),
            ("MOTOR_09_12M_SITTING_NO_SUPPORT", "Permanência sentado sem apoio e engatinhar", "Sentar independente com mãos livres para brincar e locomoção em quatro apoios.", "Cephalocaudal", 9, "9 a 12 meses"),
            ("MOTOR_09_12M_PULL_TO_STAND", "Puxar o corpo para posição bípede apoiado em mobília", "Traciona os membros superiores para ficar em pé segurando no sofá ou grade do berço.", "Cephalocaudal", 10, "9 a 12 meses"),
            ("MOTOR_09_12M_PINCER_GRASP", "Pinça fina (uso opositor do polegar e indicador)", "Pega pequenos pedaços de alimento (como grãos de feijão ou ervilha) com precisão.", "Proximodistal", 10, "9 a 12 meses"),
            ("MOTOR_12_15M_FIRST_STEPS", "Primeiros passos independentes e soltura intencional de objetos", "Marcha inicial com passos curtos e base alargada; coloca e solta blocos dentro de potes.", "Cephalocaudal", 13, "12 a 15 meses"),
            ("MOTOR_18M_STABLE_GAIT_TOWER", "Marcha estável, subir degraus com auxílio e torre de 2 a 3 blocos", "Aceleração do passo com equilíbrio e coordenação visuomotora fina para empilhar blocos.", "Proximodistal", 18, "18 meses"),
            ("MOTOR_24M_RUN_KICK_CUTLERY", "Corrida coordenada, chute de bola e uso funcional de talheres", "Sobe/desce escadas segurando no corrimão, chuta bola sem perder o equilíbrio e usa colher/garfo à mesa.", "Cephalocaudal", 24, "24 meses (2 anos)")
        };

        return templates.Select(t => new MilestoneProgress
        {
            OwnerUserId = ownerUserId,
            BabyId = babyId,
            MilestoneCode = t.Code,
            Title = t.Title,
            Description = t.Desc,
            DirectionType = t.Dir,
            ExpectedAgeMonths = t.Months,
            AgeRangeLabel = t.Range,
            Status = "NotStarted"
        }).ToList();
    }
}
