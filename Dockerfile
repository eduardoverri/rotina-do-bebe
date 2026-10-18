# ── Stage 1: Build Angular Frontend ──
FROM node:22-alpine AS build-env-ui
WORKDIR /app/ui

# Copia e instala dependências do Angular
COPY src/Frontend/package*.json ./
RUN npm install

# Copia o código-fonte e builda o frontend
COPY src/Frontend/ ./
RUN npm run build -- --configuration production

# ── Stage 2: Build .NET Backend ──
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env-api
WORKDIR /app/api

# Copia e restaura dependências do .NET
COPY src/Backend/BabyRoutine.Api/BabyRoutine.Api.csproj BabyRoutine.Api/
COPY src/Backend/BabyRoutine.Application/BabyRoutine.Application.csproj BabyRoutine.Application/
COPY src/Backend/BabyRoutine.Infrastructure/BabyRoutine.Infrastructure.csproj BabyRoutine.Infrastructure/
RUN dotnet restore BabyRoutine.Api/BabyRoutine.Api.csproj

# Copia o código-fonte e compila
COPY src/Backend/ ./
RUN dotnet publish BabyRoutine.Api/BabyRoutine.Api.csproj -c Release -o out

# ── Stage 3: Runtime ──
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# Copia os artefatos compilados do backend
COPY --from=build-env-api /app/api/out .

# Copia os artefatos compilados do frontend para a pasta wwwroot do backend
COPY --from=build-env-ui /app/ui/dist/baby-routine-frontend/browser ./wwwroot

# Expõe a porta que o .NET utilizará
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_hostBuilder__reloadConfigOnChange=false

ENTRYPOINT ["dotnet", "BabyRoutine.Api.dll"]
