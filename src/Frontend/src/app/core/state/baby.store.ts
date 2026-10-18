import { Injectable, computed, signal } from '@angular/core';

export interface PediatricianInfo {
  name: string;
  crm: string;
  emergencyPhone: string;
}

export interface ActiveMedication {
  name: string;
  dose: string;
  frequency: string;
  isContinuous: boolean;
}

export interface GrowthLog {
  measuredAt: string;
  weightGrams: number;
  heightCm: number;
  headCircumferenceCm: number;
  zScoreWeightForAge: number;
}

export interface VaccineRecord {
  code: string;
  name: string;
  recommendedMonth: number;
  status: 'Pending' | 'Applied' | 'Overdue';
  appliedAt?: string;
}

export interface BabyModel {
  id: string;
  ownerUserId?: string;
  familyId: string;
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
  pediatrician: PediatricianInfo;
  activeMedications: ActiveMedication[];
  allergies: string[];
  growthLogs: GrowthLog[];
  vaccines: VaccineRecord[];
}

export interface FamilyMember {
  userId: string;
  name: string;
  role: 'Owner' | 'Caregiver' | 'Medical';
  relation: string;
}

@Injectable({ providedIn: 'root' })
export class BabyStore {
  readonly currentUserId = signal<string>(localStorage.getItem('google_user_id') ?? '');
  readonly currentUserEmail = signal<string>(localStorage.getItem('google_user_email') ?? '');
  readonly familyName = signal<string>(localStorage.getItem('google_family_name') ?? '');
  readonly inviteCode = signal<string>(localStorage.getItem('google_invite_code') ?? '');
  readonly members = signal<FamilyMember[]>([]);
  readonly activeMember = signal<FamilyMember>({
    userId: '',
    name: localStorage.getItem('caregiver-name') ?? '',
    role: 'Owner',
    relation: 'Responsável'
  });

  readonly babies = signal<BabyModel[]>(this.loadInitialBabiesFromStorage());
  readonly selectedBabyId = signal<string>(this.loadInitialSelectedBabyId());

  readonly activeBaby = computed<BabyModel>(() => {
    const list = this.babies();
    const id = this.selectedBabyId();
    return list.find(b => b.id === id) ?? list[0] ?? this.createEmptyPlaceholderBaby();
  });

  readonly hasBabies = computed<boolean>(() => this.babies().length > 0);

  readonly chronologicalAgeDays = computed<number>(() => {
    const baby = this.activeBaby();
    if (!baby.id) return 0;
    const diff = Date.now() - new Date(baby.birthDate).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  });

  readonly correctedAgeDays = computed<number>(() => {
    const baby = this.activeBaby();
    if (!baby.id) return 0;
    const chrono = this.chronologicalAgeDays();
    if (baby.gestationalWeeks >= 37) return chrono;
    const prematureDays = (40 * 7) - (baby.gestationalWeeks * 7 + baby.gestationalDays);
    return Math.max(0, chrono - prematureDays);
  });

  selectBaby(babyId: string): void {
    this.selectedBabyId.set(babyId);
    const uid = this.currentUserId();
    const email = this.currentUserEmail();
    if (uid) {
      localStorage.setItem(`selected_baby_${uid}`, babyId);
    }
    if (email) {
      localStorage.setItem(`selected_baby_email_${email.trim().toLowerCase()}`, babyId);
    }
  }

  selectMember(member: FamilyMember): void {
    this.activeMember.set(member);
    localStorage.setItem('caregiver-role', member.role);
    localStorage.setItem('caregiver-name', member.name);
  }

  setAuthenticatedUserBabies(
    userId: string,
    familyName: string,
    inviteCode: string,
    userBabies: BabyModel[],
    userEmail?: string
  ): void {
    const resolvedEmail = (userEmail ?? this.currentUserEmail() ?? '').trim().toLowerCase();
    this.currentUserId.set(userId);
    if (resolvedEmail) {
      this.currentUserEmail.set(resolvedEmail);
      localStorage.setItem('google_user_email', resolvedEmail);
    }
    if (familyName) {
      this.familyName.set(familyName);
      localStorage.setItem('google_family_name', familyName);
    }
    if (inviteCode) {
      this.inviteCode.set(inviteCode);
      localStorage.setItem('google_invite_code', inviteCode);
    }

    const localBabies = this.getLocalBackupBabies(userId, resolvedEmail);
    const mergedBabies = this.mergeBabiesLists(userBabies ?? [], localBabies, userId);

    this.babies.set(mergedBabies);
    this.saveLocalBackupBabies(mergedBabies, userId, resolvedEmail);

    const savedSelection =
      localStorage.getItem(`selected_baby_${userId}`) ??
      (resolvedEmail ? localStorage.getItem(`selected_baby_email_${resolvedEmail}`) : null);

    if (savedSelection && mergedBabies.some(b => b.id === savedSelection)) {
      this.selectedBabyId.set(savedSelection);
    } else if (mergedBabies.length > 0) {
      this.selectedBabyId.set(mergedBabies[0].id);
    } else {
      this.selectedBabyId.set('');
    }
  }

  addBabyToCurrentUser(newBaby: BabyModel): void {
    const userId = this.currentUserId();
    const email = this.currentUserEmail();
    const existing = this.babies().filter(b => b.id !== newBaby.id);
    const updated = [...existing, newBaby];
    this.babies.set(updated);
    this.selectedBabyId.set(newBaby.id);
    this.saveLocalBackupBabies(updated, userId, email);
    this.selectBaby(newBaby.id);
  }

  updateBabyInCurrentUser(updatedBaby: BabyModel): void {
    const userId = this.currentUserId();
    const email = this.currentUserEmail();
    const exists = this.babies().some(b => b.id === updatedBaby.id);
    const updated = exists
      ? this.babies().map(b => (b.id === updatedBaby.id ? updatedBaby : b))
      : [...this.babies(), updatedBaby];
    this.babies.set(updated);
    this.saveLocalBackupBabies(updated, userId, email);
  }

  removeBabyFromCurrentUser(babyId: string): void {
    const userId = this.currentUserId();
    const email = this.currentUserEmail();
    const updated = this.babies().filter(b => b.id !== babyId);
    this.babies.set(updated);
    this.saveLocalBackupBabies(updated, userId, email);

    try {
      localStorage.removeItem(`babyroutine_events_${babyId}`);
      localStorage.removeItem(`babyroutine_allergens_${babyId}`);
      localStorage.removeItem(`babyroutine_milestones_${babyId}`);
    } catch {}

    const nextId = updated[0]?.id ?? '';
    this.selectedBabyId.set(nextId);
    if (nextId) {
      this.selectBaby(nextId);
    }
  }

  getLocalBackupBabies(userId?: string, email?: string): BabyModel[] {
    const uid = (userId ?? this.currentUserId() ?? '').trim();
    const normEmail = (email ?? this.currentUserEmail() ?? '').trim().toLowerCase();
    const byId = uid ? this.readBabiesKey(`babyroutine_babies_id_${uid}`) : [];
    const byEmail = normEmail ? this.readBabiesKey(`babyroutine_babies_email_${normEmail}`) : [];
    return this.mergeBabiesLists(byId, byEmail, uid);
  }

  saveLocalBackupBabies(babies: BabyModel[], userId?: string, email?: string): void {
    const uid = (userId ?? this.currentUserId() ?? '').trim();
    const normEmail = (email ?? this.currentUserEmail() ?? '').trim().toLowerCase();
    try {
      const serialized = JSON.stringify(babies);
      if (uid) {
        localStorage.setItem(`babyroutine_babies_id_${uid}`, serialized);
      }
      if (normEmail) {
        localStorage.setItem(`babyroutine_babies_email_${normEmail}`, serialized);
      }
    } catch {}
  }

  clearSession(): void {
    this.currentUserId.set('');
    this.currentUserEmail.set('');
    this.familyName.set('');
    this.inviteCode.set('');
    this.members.set([]);
    this.babies.set([]);
    this.selectedBabyId.set('');
  }

  private loadInitialBabiesFromStorage(): BabyModel[] {
    const uid = localStorage.getItem('google_user_id') ?? '';
    const email = localStorage.getItem('google_user_email') ?? '';
    if (!uid && !email) return [];
    return this.getLocalBackupBabies(uid, email);
  }

  private loadInitialSelectedBabyId(): string {
    const uid = localStorage.getItem('google_user_id') ?? '';
    const email = (localStorage.getItem('google_user_email') ?? '').trim().toLowerCase();
    const initialBabies = this.loadInitialBabiesFromStorage();
    const saved =
      (uid ? localStorage.getItem(`selected_baby_${uid}`) : null) ??
      (email ? localStorage.getItem(`selected_baby_email_${email}`) : null);
    if (saved && initialBabies.some(b => b.id === saved)) {
      return saved;
    }
    return initialBabies[0]?.id ?? '';
  }

  private readBabiesKey(key: string): BabyModel[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private mergeBabiesLists(primary: BabyModel[], secondary: BabyModel[], ownerUserId?: string): BabyModel[] {
    const map = new Map<string, BabyModel>();

    for (const b of [...secondary, ...primary]) {
      if (!b || !b.id) continue;
      const existing = map.get(b.id);
      if (!existing) {
        map.set(b.id, {
          ...b,
          ownerUserId: ownerUserId || b.ownerUserId,
          growthLogs: b.growthLogs ?? [],
          vaccines: b.vaccines ?? [],
          allergies: b.allergies ?? [],
          activeMedications: b.activeMedications ?? []
        });
      } else {
        const mergedLogs = this.mergeGrowthLogs(existing.growthLogs ?? [], b.growthLogs ?? []);
        const latestLog = mergedLogs.length > 0 ? mergedLogs[mergedLogs.length - 1] : null;
        map.set(b.id, {
          ...existing,
          ...b,
          ownerUserId: ownerUserId || b.ownerUserId || existing.ownerUserId,
          growthLogs: mergedLogs,
          currentWeightGrams: latestLog ? latestLog.weightGrams : (b.currentWeightGrams || existing.currentWeightGrams),
          currentHeightCm: latestLog ? latestLog.heightCm : (b.currentHeightCm || existing.currentHeightCm),
          headCircumferenceCm: latestLog ? latestLog.headCircumferenceCm : (b.headCircumferenceCm || existing.headCircumferenceCm),
          vaccines: (b.vaccines?.length ?? 0) >= (existing.vaccines?.length ?? 0) ? b.vaccines : existing.vaccines
        });
      }
    }

    return Array.from(map.values());
  }

  private mergeGrowthLogs(a: GrowthLog[], b: GrowthLog[]): GrowthLog[] {
    const map = new Map<string, GrowthLog>();
    for (const item of [...a, ...b]) {
      if (!item) continue;
      const dateKey = (item.measuredAt ?? '').slice(0, 16);
      const key = `${dateKey}_${item.weightGrams}_${item.heightCm}_${item.headCircumferenceCm}`;
      map.set(key, item);
    }
    return Array.from(map.values()).sort(
      (x, y) => new Date(x.measuredAt).getTime() - new Date(y.measuredAt).getTime()
    );
  }

  private createEmptyPlaceholderBaby(): BabyModel {
    return {
      id: '',
      familyId: '',
      name: '',
      birthDate: new Date().toISOString(),
      gestationalWeeks: 40,
      gestationalDays: 0,
      gender: '',
      birthWeightGrams: 0,
      birthLengthCm: 0,
      currentWeightGrams: 0,
      currentHeightCm: 0,
      headCircumferenceCm: 0,
      bloodType: '',
      pediatrician: { name: '', crm: '', emergencyPhone: '' },
      activeMedications: [],
      allergies: [],
      growthLogs: [],
      vaccines: []
    };
  }
}
