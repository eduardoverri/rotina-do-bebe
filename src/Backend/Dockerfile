# Estágio de Build
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY ["BabyRoutine.Api/BabyRoutine.Api.csproj", "BabyRoutine.Api/"]
COPY ["BabyRoutine.Application/BabyRoutine.Application.csproj", "BabyRoutine.Application/"]
COPY ["BabyRoutine.Infrastructure/BabyRoutine.Infrastructure.csproj", "BabyRoutine.Infrastructure/"]
RUN dotnet restore "BabyRoutine.Api/BabyRoutine.Api.csproj"
COPY . .
RUN dotnet publish "BabyRoutine.Api/BabyRoutine.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Estágio de Runtime (Ultra-Leve)
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
USER app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "BabyRoutine.Api.dll"]
