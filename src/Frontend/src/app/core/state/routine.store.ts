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
    formulaVolumeMl?: number;
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
    const userEmail = this.babyStore.currentUserEmail();
    if (!userId && !userEmail) return;

    try {
      const res = await firstValueFrom(
        this.http.get<{
          user?: { id: string; email: string };
          family: { name: string; inviteCode: string };
          babies: BabyModel[];
        }>(`${this.apiBaseUrl}/families/current`)
      );

      const effectiveUserId = res?.user?.id || userId;
      const effectiveEmail = res?.user?.email || userEmail;

      if (res?.babies) {
        this.babyStore.setAuthenticatedUserBabies(
          effectiveUserId,
          res.family.name,
          res.family.inviteCode,
          res.babies,
          effectiveEmail
        );
      }

      await this.syncLocalBackupToServer();
      await this.flushOfflineQueue();
      this.isBackendConnected.set(true);
    } catch {
      this.isBackendConnected.set(false);
      const cachedBabies = this.babyStore.getLocalBackupBabies(userId, userEmail);
      if (cachedBabies.length > 0) {
        this.babyStore.setAuthenticatedUserBabies(
          userId,
          this.babyStore.familyName() || 'Família',
          this.babyStore.inviteCode() || '',
          cachedBabies,
          userEmail
        );
      } else {
        this.popupAlert.error(
          'Não foi possível consultar os dados da família e dos filhos.',
          'Erro de Conexão'
        );
      }
    }
  }

  async syncLocalBackupToServer(): Promise<void> {
    const babies = this.babyStore.babies();
    if (babies.length === 0) return;

    const allRoutineEvents: RoutineEventModel[] = [];
    const allAllergenTrials: AllergenTrialItem['trial'][] = [];
    const allMilestones: MilestoneItem[] = [];

    for (const b of babies) {
      if (!b.id) continue;
      allRoutineEvents.push(...this.getLocalEvents(b.id));
      allAllergenTrials.push(...this.getLocalAllergenTrials(b.id).map(x => x.trial));
      allMilestones.push(...this.getLocalMilestones(b.id));
    }

    try {
      const synced = await firstValueFrom(
        this.http.post<{
          user?: { id: string; email: string };
          family: { name: string; inviteCode: string };
          babies: BabyModel[];
        }>(`${this.apiBaseUrl}/sync/restore`, {
          babies,
          routineEvents: allRoutineEvents,
          allergenTrials: allAllergenTrials,
          milestones: allMilestones
        })
      );

      if (synced?.babies) {
        this.babyStore.setAuthenticatedUserBabies(
          synced.user?.id || this.babyStore.currentUserId(),
          synced.family.name,
          synced.family.inviteCode,
          synced.babies,
          synced.user?.email || this.babyStore.currentUserEmail()
        );
      }
    } catch {
      // Ignora silenciosamente caso offline; dados permanecem seguros no armazenamento local
    }
  }

  private async flushOfflineQueue(): Promise<void> {
    const pending = await this.offlineSync.getAllQueuedEvents();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        await firstValueFrom(this.http.post(`${this.apiBaseUrl}${item.endpoint}`, item.payload));
        await this.offlineSync.clearQueuedEvent(item.localId);
      } catch {
        break;
      }
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
        'Cadastro de filho(a) realizado com sucesso.',
        'Cadastro de Filho(a)',
        { babyId: created.id }
      );
      return created;
    } catch {
      this.popupAlert.error(
        'Não foi possível salvar o cadastro do filho(a).',
        'Erro ao Cadastrar'
      );
      return null;
    }
  }

  async deleteChildForAuthenticatedUser(babyId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.apiBaseUrl}/babies/${babyId}`));
      this.popupAlert.clearHistoryForBaby(babyId);
      this.babyStore.removeBabyFromCurrentUser(babyId);
      const nextBabyId = this.babyStore.selectedBabyId();
      if (nextBabyId) {
        await this.refreshAllForBaby(nextBabyId);
      } else {
        this.clearBabyState();
      }
      this.popupAlert.info(
        'Cadastro do filho(a) e registros associados removidos com sucesso.',
        'Exclusão Concluída'
      );
    } catch {
      this.popupAlert.error(
        'Falha ao remover o cadastro do filho(a).',
        'Erro ao Excluir'
      );
    }
  }

  async refreshAllForBaby(babyId: string, notifyInfo = false, isRetryAfterRestore = false): Promise<void> {
    if (!babyId) {
      this.clearBabyState();
      return;
    }

    // Carrega imediatamente o backup local para evitar tela vazia
    const cachedEvents = this.getLocalEvents(babyId);
    const cachedTrials = this.getLocalAllergenTrials(babyId);
    const cachedMilestones = this.getLocalMilestones(babyId);
    if (cachedEvents.length > 0 && this.events().length === 0) {
      this.events.set(cachedEvents);
    }
    if (cachedTrials.length > 0 && this.allergenTrials().length === 0) {
      this.allergenTrials.set(cachedTrials);
    }
    if (cachedMilestones.length > 0 && this.milestones().length === 0) {
      this.milestones.set(cachedMilestones);
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

      const mergedEvents = this.mergeEvents(timeline.events ?? [], cachedEvents);
      this.events.set(mergedEvents);
      this.saveLocalEvents(babyId, mergedEvents);

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

      const mergedTrials = this.mergeAllergenTrials(trials ?? [], cachedTrials);
      this.allergenTrials.set(mergedTrials);
      this.saveLocalAllergenTrials(babyId, mergedTrials);

      const mergedMilestones = this.mergeMilestones(milestonesRes.milestones ?? [], cachedMilestones);
      this.milestones.set(mergedMilestones);
      this.saveLocalMilestones(babyId, mergedMilestones);

      this.isBackendConnected.set(true);

      if (notifyInfo) {
        this.popupAlert.info(
          'Prontuário e linha do tempo sincronizados com sucesso.',
          'Dados Carregados'
        );
      }

      if (timeline.isLowHydrationAlert && timeline.hydrationStatusMessage && notifyInfo) {
        this.popupAlert.warning(
          timeline.hydrationStatusMessage,
          'Aviso Clínico • Hidratação'
        );
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404 && !isRetryAfterRestore && this.babyStore.babies().length > 0) {
        await this.syncLocalBackupToServer();
        await this.refreshAllForBaby(babyId, notifyInfo, true);
        return;
      }

      this.isBackendConnected.set(false);
      this.events.set(cachedEvents);
      this.allergenTrials.set(cachedTrials);
      this.milestones.set(cachedMilestones);
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
        'Registro de fralda salvo com sucesso.',
        'Fralda Registrada'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/diapers/quick`, payload);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Registro de fralda enfileirado para sincronização.',
        'Modo Offline • Fralda Enfileirada'
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
        'Registro de mamada salvo com sucesso.',
        'Mamada Registrada'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/feeding/quick-breast`, payload);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Registro de mamada enfileirado para sincronização.',
        'Modo Offline • Mamada Enfileirada'
      );
    }
  }

  async logBottleFeeding(payload: {
    feedingType: 'Formula' | 'ExpressedMilk';
    volumeMl: number;
    notes?: string;
  }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    const label = payload.feedingType === 'Formula' ? 'Fórmula' : 'Leite';
    const dto = {
      category: 'Feeding',
      timestamp: new Date().toISOString(),
      recordedByName: this.babyStore.activeMember().name,
      details: {
        feedingType: payload.feedingType,
        formulaVolumeMl: payload.volumeMl
      },
      notes: payload.notes ?? `${label} (${payload.volumeMl} mL).`
    };

    try {
      const created = await firstValueFrom(
        this.http.post<RoutineEventModel>(`${this.apiBaseUrl}/babies/${babyId}/events`, dto)
      );
      this.handleEventCreated(
        created,
        'Registro de alimentação líquida salvo com sucesso.',
        `${label} Registrada`
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/events`, dto);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Registro enfileirado para sincronização.',
        'Modo Offline • Registro Enfileirado'
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
        'Refeição sólida salva com sucesso.',
        'Refeição Sólida Salva'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/feeding/solids-plate`, payload);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Refeição enfileirada para sincronização.',
        'Modo Offline • Refeição Enfileirada'
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
        'Sessão de sono salva com sucesso.',
        'Sono Registrado'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/events`, dto);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Sessão de sono enfileirada para sincronização.',
        'Modo Offline • Sono Enfileirado'
      );
    }
  }

  async startAllergenTrial(payload: { foodName: string; foodCategory: string; initialQuantityOffered: string; notes?: string }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    try {
      await firstValueFrom(this.http.post(`${this.apiBaseUrl}/babies/${babyId}/feeding/allergen-trial`, payload));
      this.popupAlert.success(
        'Protocolo alergênico de 72h iniciado com sucesso.',
        'Protocolo 72h Iniciado'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      this.popupAlert.error(
        'Não foi possível iniciar o protocolo alergênico de 72h.',
        'Erro ao Salvar'
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
            'Emergência Alérgica'
          );
        } else {
          this.popupAlert.warning(
            updated.evaluation.clinicalGuidance,
            'Reação Alérgica'
          );
        }
      } else {
        this.popupAlert.success(
          'Checklist de sintomas atualizado sem reação adversa.',
          'Monitoramento 72h Atualizado'
        );
      }
      await this.refreshAllForBaby(babyId);
    } catch {
      this.popupAlert.error(
        'Erro ao atualizar o checklist de sintomas alergênicos.',
        'Erro ao Atualizar'
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
      this.popupAlert.incompleteForm('Selecione um filho(a) antes de registrar medicação.');
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
        'Medicação validada e registrada com sucesso.',
        'Medicação Administrada'
      );
      await this.refreshAllForBaby(babyId);
      return { ok: true, message: res.safety.message };
    } catch (err: unknown) {
      const errorObj = err as { error?: { message?: string } };
      const msg = errorObj?.error?.message ?? 'Bloqueio farmacológico de segurança: verifique dose máxima por peso ou intervalo mínimo.';
      this.popupAlert.error(msg, 'Bloqueio Farmacológico');
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
        'Marco motor atualizado com sucesso.',
        'Marco Motor Salvo'
      );
      await this.refreshAllForBaby(babyId);
    } catch {
      this.popupAlert.error(
        'Erro ao atualizar o marco motor.',
        'Erro ao Atualizar'
      );
    }
  }

  async logGrowthMeasurement(payload: {
    measuredAt?: string;
    weightGrams: number;
    heightCm: number;
    headCircumferenceCm: number;
    zScoreWeightForAge?: number;
  }): Promise<void> {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return;
    try {
      const updatedBaby = await firstValueFrom(
        this.http.post<BabyModel>(`${this.apiBaseUrl}/babies/${babyId}/growth`, payload)
      );
      this.babyStore.updateBabyInCurrentUser(updatedBaby);
      this.popupAlert.success(
        'Aferição antropométrica e curva OMS registradas com sucesso.',
        'Antropometria Registrada'
      );
    } catch {
      await this.offlineSync.enqueueOfflineEvent(babyId, `/babies/${babyId}/growth`, payload);
      this.popupAlert.warning(
        'Sem conexão com o servidor. Aferição antropométrica enfileirada para sincronização.',
        'Modo Offline • Antropometria Enfileirada'
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

  private handleEventCreated(ev: RoutineEventModel, successMsg: string, title = 'Registro Salvo'): void {
    const babyId = ev.babyId || this.babyStore.selectedBabyId();
    this.events.update(list => {
      const updated = this.mergeEvents([ev], list);
      if (babyId) {
        this.saveLocalEvents(babyId, updated);
      }
      return updated;
    });
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

  private getLocalEvents(babyId: string): RoutineEventModel[] {
    if (!babyId) return [];
    try {
      const raw = localStorage.getItem(`babyroutine_events_${babyId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalEvents(babyId: string, events: RoutineEventModel[]): void {
    if (!babyId) return;
    try {
      localStorage.setItem(`babyroutine_events_${babyId}`, JSON.stringify(events.slice(0, 250)));
    } catch {}
  }

  private getLocalAllergenTrials(babyId: string): AllergenTrialItem[] {
    if (!babyId) return [];
    try {
      const raw = localStorage.getItem(`babyroutine_allergens_${babyId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalAllergenTrials(babyId: string, items: AllergenTrialItem[]): void {
    if (!babyId) return;
    try {
      localStorage.setItem(`babyroutine_allergens_${babyId}`, JSON.stringify(items));
    } catch {}
  }

  private getLocalMilestones(babyId: string): MilestoneItem[] {
    if (!babyId) return [];
    try {
      const raw = localStorage.getItem(`babyroutine_milestones_${babyId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalMilestones(babyId: string, items: MilestoneItem[]): void {
    if (!babyId) return;
    try {
      localStorage.setItem(`babyroutine_milestones_${babyId}`, JSON.stringify(items));
    } catch {}
  }

  private mergeEvents(serverEvents: RoutineEventModel[], localEvents: RoutineEventModel[]): RoutineEventModel[] {
    const map = new Map<string, RoutineEventModel>();
    for (const ev of [...localEvents, ...serverEvents]) {
      if (!ev || !ev.id) continue;
      map.set(ev.id, ev);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private mergeAllergenTrials(serverTrials: AllergenTrialItem[], localTrials: AllergenTrialItem[]): AllergenTrialItem[] {
    const map = new Map<string, AllergenTrialItem>();
    for (const item of [...localTrials, ...serverTrials]) {
      if (!item?.trial?.id) continue;
      map.set(item.trial.id, item);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.trial.introducedAt).getTime() - new Date(a.trial.introducedAt).getTime()
    );
  }

  private mergeMilestones(serverMilestones: MilestoneItem[], localMilestones: MilestoneItem[]): MilestoneItem[] {
    const map = new Map<string, MilestoneItem>();
    for (const m of [...serverMilestones, ...localMilestones]) {
      if (!m?.milestoneCode) continue;
      const existing = map.get(m.milestoneCode);
      if (!existing) {
        map.set(m.milestoneCode, m);
      } else {
        // Prioriza o status mais avançado caso o servidor tenha acabado de reiniciar com NotStarted
        const rank = (s: string) => (s === 'Achieved' ? 2 : s === 'InProgress' ? 1 : 0);
        map.set(m.milestoneCode, rank(m.status) >= rank(existing.status) ? m : existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.expectedAgeMonths - b.expectedAgeMonths);
  }
}
