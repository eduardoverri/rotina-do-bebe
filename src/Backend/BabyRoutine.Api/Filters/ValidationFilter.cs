using FluentValidation;

namespace BabyRoutine.Api.Filters;

public class ValidationFilter<T>(IValidator<T>? validator = null) : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (validator is null)
        {
            return await next(context);
        }

        var entity = context.Arguments.OfType<T>().FirstOrDefault();
        if (entity is null)
        {
            return Results.BadRequest(new { message = "Payload de requisição inválido." });
        }

        var validationResult = await validator.ValidateAsync(entity);
        if (!validationResult.IsValid)
        {
            return Results.ValidationProblem(validationResult.ToDictionary());
        }

        return await next(context);
    }
}
