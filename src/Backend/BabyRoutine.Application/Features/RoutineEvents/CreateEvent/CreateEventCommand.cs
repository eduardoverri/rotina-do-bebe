using BabyRoutine.Application.Common.Models;
using FluentValidation;

namespace BabyRoutine.Application.Features.RoutineEvents.CreateEvent;

public record CreateRoutineEventDto(
    string Category,
    DateTime? Timestamp,
    DateTime? EndTimestamp,
    int? DurationMinutes,
    RoutineEventDetails? Details,
    string? Notes,
    string? RecordedByName
);

public class CreateEventValidator : AbstractValidator<CreateRoutineEventDto>
{
    private static readonly string[] AllowedCategories =
    [
        RoutineCategory.Diaper,
        RoutineCategory.Sleep,
        RoutineCategory.Feeding,
        RoutineCategory.Medication,
        RoutineCategory.Bath,
        RoutineCategory.WakeUp
    ];

    public CreateEventValidator()
    {
        RuleFor(x => x.Category)
            .NotEmpty().WithMessage("A categoria do evento é obrigatória.")
            .Must(c => AllowedCategories.Contains(c))
            .WithMessage($"Categoria inválida. Valores aceitos: {string.Join(", ", AllowedCategories)}.");
    }
}
