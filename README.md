# Sistema de Gestão da Rotina do Bebê (0 a 24 Meses)

Implementação completa baseada nos documentos:
- [DOCUMENTO_DE_DESIGN_SISTEMA_ROTINA_DO_BEBE.md](file:///C:/Users/eduar/Documents/git/rotina-do-bebe/DOCUMENTO_DE_DESIGN_SISTEMA_ROTINA_DO_BEBE.md)
- [rotinas_de_beb_s_at_2_anos_guia_completo.md](file:///C:/Users/eduar/Documents/git/rotina-do-bebe/rotinas_de_beb_s_at_2_anos_guia_completo.md)

---

## Arquitetura Implementada

### 1. Back-End (.NET Minimal APIs + SignalR + MongoDB 8.0 / Hybrid Store)
Localizado em `src/Backend/`:
- **`BabyRoutine.Application`**:
  - Modelos Polimórficos (`Family`, `Baby`, `RoutineEvent`, `AllergenTrial`, `MilestoneProgress`, `GrowthLog`, `VaccineRecord`) com suporte a **Idade Cronológica** e **Idade Corrigida** para prematuros (< 37 semanas).
  - **Motores Clínicos e Algorítmicos**:
    - `WakeWindowEngine`: Calcula a janela fisiológica de vigília por faixa etária (0 a 24 meses), *Sweet Spot* de sono e prontidão para transição de sonecas (4→3, 3→2, 2→1).
    - `MedicationSafetyEngine`: Valida dosagem máxima por quilo (`mg/kg`) e bloqueia administrações antes do intervalo mínimo de segurança (6h para Paracetamol/Dipirona, 8h para Ibuprofeno).
    - `PediatricStoolClassifier`: Triagem automática de sinais de alerta nas fezes (**Acolia Fecal** branca/acinzentada = Emergência; **Melena** preta = Urgente; **Sangue vivo / APLV** = Alta Prioridade; frequência diária de urina e prevenção de dermatites).
    - `AllergenTrialEngine`: Monitoramento ativo da janela de 72 horas na introdução de alérgenos (ovo, peixe, amendoim, glúten, leite) e checklist de reações agudas.
    - `PediatricReportEngine`: Consolidação clínica com curvas de crescimento OMS (Z-Score) para consultas pediátricas.
- **`BabyRoutine.Infrastructure`**:
  - `MongoDbContext` com criação automática dos 4 índices compostos (`idx_routine_baby_timestamp_desc`, `idx_routine_baby_category_timestamp`, `idx_routine_baby_medication_interval`, `idx_allergen_baby_status_monitoring`) e fallback híbrido em memória pré-populado (`SeedData`) para execução imediata mesmo sem instância MongoDB ativa.
  - `MedicationReminderJob`: Serviço em background para atualização de janelas de 72h de alérgenos.
- **`BabyRoutine.Api`**:
  - Endpoints REST Minimal APIs organizados sob `/api/babies/{babyId}`, validação via `FluentValidation` e sincronização familiar em tempo real com `FamilyHub` (SignalR).
- **`BabyRoutine.Tests`**:
  - Suíte de testes unitários e de integração xUnit (`WebApplicationFactory<Program>`) validando todos os motores clínicos e endpoints.

### 2. Front-End (Angular 19+ Standalone, Signals, PWA Offline-First)
Localizado em `src/Frontend/`:
- **Design System "Fricção Zero no Escuro" (Modo Madrugada `#0A0B0E`)**:
  - Usa `<meta name="color-scheme" content="light dark">`, CSS `light-dark()`, `:has()` e suporte a *Forced Colors Mode* (Alto Contraste), com ativação automática entre 20h e 06h.
- **Ergonomia de Uma Mão (`QuickActionBarComponent`)**:
  - Barra inferior fixa para registro em 1 toque de Amamentação (alternando automaticamente o último seio), Soneca, Fralda (`U2`) e Medicação.
- **Sincronização Offline (`OfflineSyncService` + IndexedDB) e Tempo Real (`FamilyRealtimeService` + SignalR)**.

---

## Como Executar

### 1. Executar Testes Automatizados do Back-End
```powershell
& "C:\Program Files\dotnet\dotnet.exe" test src\Backend\BabyRoutine.slnx
```

### 2. Iniciar a API Back-End (.NET)
```powershell
& "C:\Program Files\dotnet\dotnet.exe" run --project src\Backend\BabyRoutine.Api\BabyRoutine.Api.csproj --urls "http://localhost:5000"
```

### 3. Iniciar o Front-End (Angular 19 PWA)
```powershell
cd src\Frontend
npm start
```
Acesse em `http://localhost:4200`.
