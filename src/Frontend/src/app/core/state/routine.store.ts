import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BabyModel, BabyStore } from './baby.store';
import { OfflineSyncService } from '../services/offline-sync.service';
import { WakeWindowTimerService } from '../services/wake-window-timer.service';
import { FamilyRealtimeService } from '../services/family-realtime.service';
import { PopupAlertService } from '../services/popup-alert.service';

export interface RoutineEventModel {
  id: string;
  ownerUserId?: string;
  babyId: string;
  recordedByName: string;
  category: 'Diaper' | 'Sleep' | 'Feeding' | 'Medication' | 'Bath' | 'WakeUp';
  timestamp: string;
  endTimestamp?: string;
  durationMinutes?: number;
  details: {
    state?: string;
    volumeLevel?: number;
    stoolConsistency?: string;
    stoolColor?: string;
    hasMucus?: boolean;
    hasBlood?: boolean;
    barrierCreamApplied?: boolean;
    sleepType?: string;
    wakeWindowPrecedingMinutes?: number;
    sleepLocation?: string;
    fallingAsleepMethod?: string;
    sleepQuality?: string;
    awakeningsCount?: number;
    hadResistance?: boolean;
    feedingType?: string;
    breastfeedingDetails?: {
      lastSideOffered: string;
      leftDurationSeconds: number;
      rightDurationSeconds: number;
      hungerCueStage?: string;
      satietyCues?: string[];
    };
    solidsDetails?: {
      mealType: string;
      foodGroups: {
        fruitsAndVegetables: string[];
        cerealsAndTubers: string[];
        legumes: string[];
        animalProtein: string[];
      };
      acceptanceLevel: string;
      eatingAutonomy: string;
      allergensPresented: string[];
    };
    medicationName?: string;
    dosageGiven?: string;
    dosageMg?: number;
    babyWeightAtTimeKg?: number;
    reason?: string;
    measuredTemperatureCelsius?: number;
    minimumIntervalHours?: number;
    nextAllowedDoseAt?: string;
  };
  clinicalFlags: {
    isRedFlagAlert: boolean;
    alertMessage?: string | null;
    urgencyLevel: 'Normal' | 'HighPriority' | 'Urgent' | 'Emergency';
  };
  notes?: string;
}

export interface WakeWindowStatusDto {
  awakeDurationMinutes: number;
  minWindowMinutes: number;
  maxWindowMinutes: number;
  expectedNaps: number;
  stageDescription: string;
  state: string;
  alertLevel: 'Normal' | 'Optimal' | 'Overdue';
  idealSleepTime: string;
  maxSleepTime: string;
  remainingMinutesToSweetSpot: number;
  environmentSuggestion: string;
}

export interface NapTransitionReadinessDto {
  ageInMonths: number;
  targetTransition: string;
  daysWithResistanceLast10Days: number;
  requiredConsecutiveDaysThreshold: number;
  isTransitionRecommended: boolean;
  averageRealWakeWindowMinutes: number;
  clinicalRecommendation: string;
}

export interface AllergenTrialItem {
  trial: {
    id: string;
    babyId: string;
    foodName: string;
    foodCategory: string;
    introducedAt: string;
    monitoringEndsAt: string;
    status: 'MonitoringActive' | 'ReactionReported' | 'SafeCompleted';
    exposureDoses: { day: number; quantityOffered: string; reactionObserved: boolean }[];
    symptomsChecklist: {
      hivesOrRash: boolean;
      facialSwelling: boolean;
      acuteVomiting: boolean;
      explosiveDiarrhea: boolean;
      wheezing: boolean;
    };
    pediatricianNotes?: string;
  };
  evaluation: {
    status: string;
    remainingHours: number;
    hasAlertSymptoms: boolean;
    clinicalGuidance: string;
  };
}

export interface MilestoneItem {
  id: string;
  babyId: string;
  milestoneCode: string;
  title: string;
  description: string;
  directionType: 'Cephalocaudal' | 'Proximodistal';
  expectedAgeMonths: number;
  ageRangeLabel: string;
  status: 'NotStarted' | 'InProgress' | 'Achieved';
  achievedAtDate?: string;
  actualAgeAtAchievementDays?: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class RoutineStore {
  private readonly http = inject(HttpClient);
  private readonly babyStore = inject(BabyStore);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly wakeTimer = inject(WakeWindowTimerService);
  private readonly realtime = inject(FamilyRealtimeService);
  private readonly popupAlert = inject(PopupAlertService);

  readonly apiBaseUrl =
    typeof window !== 'undefined' && window.location.port === '4200'
      ? 'http://localhost:5000/api'
      : '/api';
  readonly isBackendConnected = signal<boolean>(false);

  // Estado da Timeline Diária (apenas dados reais existentes do Filho selecionado)
  readonly events = signal<RoutineEventModel[]>([]);
  readonly totalSleepMinutes = signal<number>(0);
  readonly napCount = signal<number>(0);
  readonly expectedNaps = signal<number>(0);
  readonly totalDiaperChanges = signal<number>(0);
  readonly urineOrMixedCount = signal<number>(0);
  readonly stoolOrMixedCount = signal<number>(0);
  readonly isLowHydrationAlert = signal<boolean>(false);
  readonly hydrationStatusMessage = signal<string>('');
  readonly lastFeedingSummary = signal<string>('Nenhum registro');
  readonly lastDiaperSummary = signal<string>('Nenhum registro');
  readonly lastBreastSide = signal<'Left' | 'Right'>('Left');

  readonly wakeWindowStatus = signal<WakeWindowStatusDto>({
    awakeDurationMinutes: 0,
    minWindowMinutes: 0,
    maxWindowMinutes: 0,
    expectedNaps: 0,
    stageDescription: '',
    state: '',
    alertLevel: 'Normal',
    idealSleepTime: new Date().toISOString(),
    maxSleepTime: new Date().toISOString(),
    remainingMinutesToSweetSpot: 0,
    environmentSuggestion: ''
  });

  readonly napTransition = signal<NapTransitionReadinessDto>({
    ageInMonths: 0,
    targetTransition: '',
    daysWithResistanceLast10Days: 0,
    requiredConsecutiveDaysThreshold: 7,
    isTransitionRecommended: false,
    averageRealWakeWindowMinutes: 0,
    clinicalRecommendation: ''
  });

  readonly allergenTrials = signal<AllergenTrialItem[]>([]);
  readonly milestones = signal<MilestoneItem[]>([]);

  async initialize(): Promise<void> {
    await this.loadFamilyAndBabies();
    const babyId = this.babyStore.selectedBabyId();
    if (babyId) {
      await this.refreshAllForBaby(babyId, true);
    } else {
      this.clearBabyState();
    }

    const familyId = this.babyStore.activeBaby().familyId;
    if (familyId) {
      await this.realtime.connect(this.apiBaseUrl, familyId, () => {
        const currentBabyId = this.babyStore.selectedBabyId();
        if (currentBabyId) {
          this.refreshAllForBaby(currentBabyId);
        }
      });
    }
  }

  async loadFamilyAndBabies(): Promise<void> {
    const userId = this.babyStore.currentUserId();
    if (!userId) return;

    try {
      const res = await firstValueFrom(
        this.http.get<{ family: { name: string; inviteCode: string }; babies: BabyModel[] }>(`${this.apiBaseUrl}/families/current`)
      );
      if (res?.babies) {
        this.babyStore.setAuthenticatedUserBabies(userId, res.family.name, res.family.inviteCode, res.babies);
      }
      this.isBackendConnected.set(true);
    } catch {
      this.isBackendConnected.set(false);
      this.popupAlert.error(
        'Não foi possível consultar a família e os filhos no banco de dados.',
        'Erro de Conexão com o Banco de Dados'
      );
    }
  }

  async createChildForAuthenticatedUser(payload: {
    name: string;
    birthDate: string;
    gestationalWeeks: number;
    gestationalDays: number;
    gender: string;
    birthWeightGrams: number;
    birthLengthCm: number;
    currentWeightGrams: number;
    currentHeightCm: number;
    headCircumferenceCm: number;
    bloodType: string;
    pediatricianName?: string;
    pediatricianCrm?: string;
    pediatricianPhone?: string;
  }): Promise<BabyModel | null> {
    try {
      const created = await firstValueFrom(
        this.http.post<BabyModel>(`${this.apiBaseUrl}/babies`, payload)
      );
      this.babyStore.addBabyToCurrentUser(created);
      await this.refreshAllForBaby(created.id);
      this.popupAlert.success(
        `Filho(a) "${created.name}" gravado(a) no banco de dados com marcos motores iniciais!`,
        'Banco de Dados • Cadastro de Filho(a)'
      );
      return created;
    } catch {
      this.popupAlert.error(
        'Não foi possível salvar o cadastro do filho(a) no banco de dados.',
        'Erro no Banco de Dados'
      );
      return null;
    }
  }

  async deleteChildForAuthenticatedUser(babyId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.apiBaseUrl}/babies/${babyId}`));
      this.babyStore.removeBabyFromCurrentUser(babyId);
      const nextBabyId = this.babyStore.selectedBabyId();
      if (nextBabyId) {
        await this.refreshAllForBaby(nextBabyId);
      } else {
        this.clearBabyState();
      }
      this.popupAlert.info(
        'Cadastro do filho(a) e seus registros associados foram removidos do banco de dados.',
        'Banco de Dados • Exclusão Concluída'
      );
    } catch {
      this.popupAlert.error(
        'Falha ao remover o cadastro do filho(a) do banco de dados.',
        'Erro no Banco de Dados'
      );
    }
  }

  async refreshAllForBaby(babyId: string, notifyInfo = false): Promise<void> {
    if (!babyId) {
      this.clearBabyState();
      return;
    }

    try {
      const [timeline, wakeRes, transition, trials, milestonesRes] = await Promise.all([
        firstValueFrom(this.http.get<{
          totalSleepMinutes: number;
          napCount: number;
          expectedNaps: number;
          totalDiaperChanges: number;
          urineOrMixedCount: number;
          stoolOrMixedCount: number;
          isLowHydrationAlert: boolean;
          hydrationStatusMessage: string;
          lastFeedingSummary: string;
          lastDiaperSummary: string;
          events: RoutineEventModel[];
        }>(`${this.apiBaseUrl}/babies/${babyId}/timeline`)),
        firstValueFrom(this.http.get<{ lastWakeTimeUtc: string; status: WakeWindowStatusDto }>(`${this.apiBaseUrl}/babies/${babyId}/sleep/wake-window`)),
        firstValueFrom(this.http.get<NapTransitionReadinessDto>(`${this.apiBaseUrl}/babies/${babyId}/sleep/transition-readiness`)),
        firstValueFrom(this.http.get<AllergenTrialItem[]>(`${this.apiBaseUrl}/babies/${babyId}/feeding/allergen-trials`)),
        firstValueFrom(this.http.get<{ milestones: MilestoneItem[] }>(`${this.apiBaseUrl}/babies/${babyId}/milestones`))
      ]);

      this.events.set(timeline.events);
      this.totalSleepMinutes.set(timeline.totalSleepMinutes);
      this.napCount.set(timeline.napCount);
      this.expectedNaps.set(timeline.expectedNaps);
      this.totalDiaperChanges.set(timeline.totalDiaperChanges);
      this.urineOrMixedCount.set(timeline.urineOrMixedCount);
      this.stoolOrMixedCount.set(timeline.stoolOrMixedCount);
      this.isLowHydrationAlert.set(timeline.isLowHydrationAlert);
      this.hydrationStatusMessage.set(timeline.hydrationStatusMessage);
      this.lastFeedingSummary.set(timeline.lastFeedingSummary);
      this.lastDiaperSummary.set(timeline.lastDiaperSummary);

      this.wakeWindowStatus.set(wakeRes.status);
      this.wakeTimer.configureFromBackend(
        wakeRes.lastWakeTimeUtc,
        wakeRes.status.minWindowMinutes,
        wakeRes.status.maxWindowMinutes
      );

      this.napTransition.set(transition);
      this.allergenTrials.set(trials);
      this.milestones.set(milestonesRes.milestones);
      this.isBackendConnected.set(true);

      if (notifyInfo) {
        const babyName = this.babyStore.activeBaby().name;
        this.popupAlert.info(
          `Prontuário de ${babyName} sincronizado do banco de dados (${timeline.events.length} registro(s) na linha do tempo).`,
          'Banco de Dados • Dados Carregados'
        );
      }

      if (timeline.isLowHydrationAlert && timeline.hydrationStatusMessage && notifyInfo) {
        this.popupAlert.warning(
          timeline.hydrationStatusMessage,
          'Aviso Clínico • Hidratação'
        );
      }
    } catch {
      this.isBackendConnected.set(false);
      this.popupAlert.error(
        'Não foi possível carregar os registros do filho(a) a partir do banco de dados.',
        'Erro de Leitura no Banco de Dados'
      );
    }
  }

  async logQuickDiaper(payload: {
    code: string;
    volumeLevel: number;
    stoolColor?: string;
    stoolConsistency?: string;
    hasMucus?: boolean;
    hasBlood?: boolean;
    barrierCreamApplied: boolean;
    notes?: string;
  }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    try {
      const created = await firstValueFrom(
        this.http.post<RoutineEventModel>(`${this.apiBaseUrl}/babies/${babyId}/diapers/quick`, payload)
      );
      this.handleEventCreated(
        created,
        `Fralda (${payload.code}) de ${this.babyStore.activeBaby().name} gravada no banco de dados!`,
        'Banco de Dados • Fralda Registrada'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/diapers/quick`, payload);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Fralda salva no banco local (IndexedDB) para sincronização.',
        'Banco Local Offline • Fralda Enfileirada'
      );
    }
  }

  async logQuickBreastfeeding(payload: {
    side: string;
    leftDurationSeconds: number;
    rightDurationSeconds: number;
    hungerCueStage?: string;
    satietyCues?: string[];
    notes?: string;
  }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    this.lastBreastSide.set(payload.side === 'Right' ? 'Right' : 'Left');
    try {
      const created = await firstValueFrom(
        this.http.post<RoutineEventModel>(`${this.apiBaseUrl}/babies/${babyId}/feeding/quick-breast`, payload)
      );
      this.handleEventCreated(
        created,
        `Mamada de ${this.babyStore.activeBaby().name} gravada no banco de dados!`,
        'Banco de Dados • Mamada Registrada'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/feeding/quick-breast`, payload);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Mamada salva no banco local (IndexedDB) para sincronização.',
        'Banco Local Offline • Mamada Enfileirada'
      );
    }
  }

  async logSolidsPlate(payload: {
    mealType: string;
    fruitsAndVegetables: string[];
    cerealsAndTubers: string[];
    legumes: string[];
    animalProtein: string[];
    acceptanceLevel: string;
    eatingAutonomy: string;
    allergensPresented: string[];
    notes?: string;
  }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    try {
      const created = await firstValueFrom(
        this.http.post<RoutineEventModel>(`${this.apiBaseUrl}/babies/${babyId}/feeding/solids-plate`, payload)
      );
      this.handleEventCreated(
        created,
        `Prato dos 4 Grupos de ${this.babyStore.activeBaby().name} gravado no banco de dados!`,
        'Banco de Dados • Refeição Sólida Salva'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/feeding/solids-plate`, payload);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Refeição salva no banco local (IndexedDB) para sincronização.',
        'Banco Local Offline • Refeição Enfileirada'
      );
    }
  }

  async logSleepSession(payload: {
    sleepType: 'Nap' | 'NightSleep';
    durationMinutes: number;
    sleepLocation: string;
    fallingAsleepMethod: string;
    sleepQuality: string;
    awakeningsCount: number;
    hadResistance: boolean;
    notes?: string;
  }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    const now = new Date();
    const start = new Date(now.getTime() - payload.durationMinutes * 60000);
    const dto = {
      category: 'Sleep',
      timestamp: start.toISOString(),
      endTimestamp: now.toISOString(),
      durationMinutes: payload.durationMinutes,
      recordedByName: this.babyStore.activeMember().name,
      details: {
        sleepType: payload.sleepType,
        wakeWindowPrecedingMinutes: this.wakeTimer.awakeMinutes(),
        sleepLocation: payload.sleepLocation,
        fallingAsleepMethod: payload.fallingAsleepMethod,
        sleepQuality: payload.sleepQuality,
        awakeningsCount: payload.awakeningsCount,
        hadResistance: payload.hadResistance
      },
      notes: payload.notes ?? `${payload.sleepType === 'Nap' ? 'Soneca' : 'Sono noturno'} (${payload.durationMinutes} min no ${payload.sleepLocation}).`
    };

    try {
      const created = await firstValueFrom(
        this.http.post<RoutineEventModel>(`${this.apiBaseUrl}/babies/${babyId}/events`, dto)
      );
      this.handleEventCreated(
        created,
        `Sessão de sono (${payload.durationMinutes} min) de ${this.babyStore.activeBaby().name} gravada no banco de dados!`,
        'Banco de Dados • Sono Registrado'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/events`, dto);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Sessão de sono salva no banco local (IndexedDB) para sincronização.',
        'Banco Local Offline • Sono Enfileirado'
      );
    }
  }

  async startAllergenTrial(payload: { foodName: string; foodCategory: string; initialQuantityOffered: string; notes?: string }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    try {
      await firstValueFrom(this.http.post(`${this.apiBaseUrl}/babies/${babyId}/feeding/allergen-trial`, payload));
      this.popupAlert.success(
        `Protocolo alergênico de 72h para "${payload.foodName}" registrado no banco de dados (${this.babyStore.activeBaby().name})!`,
        'Banco de Dados • Protocolo 72h Iniciado'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      this.popupAlert.error(
        'Não foi possível gravar o protocolo alergênico de 72h no banco de dados.',
        'Erro no Banco de Dados'
      );
    }
  }

  async updateAllergenSymptoms(trialId: string, symptoms: {
    hivesOrRash: boolean;
    facialSwelling: boolean;
    acuteVomiting: boolean;
    explosiveDiarrhea: boolean;
    wheezing: boolean;
  }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    try {
      const updated = await firstValueFrom(
        this.http.put<AllergenTrialItem>(`${this.apiBaseUrl}/babies/${babyId}/feeding/allergen-trial/${trialId}`, symptoms)
      );
      if (updated.evaluation.hasAlertSymptoms) {
        if (symptoms.facialSwelling || symptoms.wheezing) {
          this.popupAlert.error(
            updated.evaluation.clinicalGuidance,
            'Emergência Alérgica • Gravada no Banco'
          );
        } else {
          this.popupAlert.warning(
            updated.evaluation.clinicalGuidance,
            'Reação Alérgica • Gravada no Banco'
          );
        }
      } else {
        this.popupAlert.success(
          `Checklist de sintomas de "${updated.trial.foodName}" atualizado no banco de dados sem reação adversa.`,
          'Banco de Dados • Monitoramento 72h Atualizado'
        );
      }
      await this.refreshAllForBaby(babyId);
    } catch {
      this.popupAlert.error(
        'Erro ao atualizar checklist de sintomas alergênicos no banco de dados.',
        'Erro no Banco de Dados'
      );
    }
  }

  async administerMedication(payload: {
    medicationName: string;
    doseMg: number;
    dosageGiven: string;
    measuredTemperatureCelsius?: number;
    reason?: string;
    notes?: string;
  }): Promise<{ ok: boolean; message: string }> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) {
      this.popupAlert.warning('Selecione um filho(a) antes de registrar medicação.', 'Aviso de Validação');
      return { ok: false, message: 'Selecione um filho(a) primeiro.' };
    }
    try {
      const res = await firstValueFrom(
        this.http.post<{ routineEvent: RoutineEventModel; safety: { message: string } }>(
          `${this.apiBaseUrl}/babies/${babyId}/medications/administer`,
          payload
        )
      );
      this.handleEventCreated(
        res.routineEvent,
        `${res.safety.message} (Dose gravada no banco de dados).`,
        'Banco de Dados • Medicação Administrada'
      );
      await this.refreshAllForBaby(babyId);
      return { ok: true, message: res.safety.message };
    } catch (err: unknown) {
      const errorObj = err as { error?: { message?: string } };
      const msg = errorObj?.error?.message ?? 'Bloqueio farmacológico de segurança: verifique dose máxima por peso ou intervalo mínimo.';
      this.popupAlert.error(msg, 'Bloqueio Farmacológico • Gravação Recusada');
      return { ok: false, message: msg };
    }
  }

  async updateMilestoneStatus(milestoneCode: string, status: 'NotStarted' | 'InProgress' | 'Achieved', notes?: string): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    try {
      await firstValueFrom(
        this.http.put(`${this.apiBaseUrl}/babies/${babyId}/milestones/${milestoneCode}`, { status, notes })
      );
      this.popupAlert.success(
        `Marco motor (${milestoneCode}) de ${this.babyStore.activeBaby().name} atualizado no banco de dados!`,
        'Banco de Dados • Marco Motor Salvo'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      this.popupAlert.error(
        'Erro ao atualizar o marco motor no banco de dados.',
        'Erro no Banco de Dados'
      );
    }
  }

  private clearBabyState(): void {
    this.events.set([]);
    this.totalSleepMinutes.set(0);
    this.napCount.set(0);
    this.expectedNaps.set(0);
    this.totalDiaperChanges.set(0);
    this.urineOrMixedCount.set(0);
    this.stoolOrMixedCount.set(0);
    this.isLowHydrationAlert.set(false);
    this.hydrationStatusMessage.set('');
    this.lastFeedingSummary.set('Nenhum registro');
    this.lastDiaperSummary.set('Nenhum registro');
    this.allergenTrials.set([]);
    this.milestones.set([]);
  }

  private handleEventCreated(ev: RoutineEventModel, successMsg: string, title = 'Banco de Dados • Registro Salvo'): void {
    this.events.update(list => [ev, ...list]);
    this.popupAlert.success(successMsg, title);
    if (ev.clinicalFlags?.isRedFlagAlert && ev.clinicalFlags.alertMessage) {
      if (ev.clinicalFlags.urgencyLevel === 'Emergency' || ev.clinicalFlags.urgencyLevel === 'Urgent') {
        this.popupAlert.error(
          ev.clinicalFlags.alertMessage,
          'Alerta Clínico Pediátrico (Red Flag)'
        );
      } else {
        this.popupAlert.warning(
          ev.clinicalFlags.alertMessage,
          'Aviso Clínico Pediátrico'
        );
      }
    }
  }
}
