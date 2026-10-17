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
  readonly familyName = signal<string>('');
  readonly inviteCode = signal<string>('');
  readonly members = signal<FamilyMember[]>([]);
  readonly activeMember = signal<FamilyMember>({
    userId: '',
    name: localStorage.getItem('caregiver-name') ?? '',
    role: 'Owner',
    relation: 'Responsável'
  });

  readonly babies = signal<BabyModel[]>([]);
  readonly selectedBabyId = signal<string>('');

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
    if (uid) {
      localStorage.setItem(`selected_baby_${uid}`, babyId);
    }
  }

  selectMember(member: FamilyMember): void {
    this.activeMember.set(member);
    localStorage.setItem('caregiver-role', member.role);
    localStorage.setItem('caregiver-name', member.name);
  }

  setAuthenticatedUserBabies(userId: string, familyName: string, inviteCode: string, userBabies: BabyModel[]): void {
    this.currentUserId.set(userId);
    this.familyName.set(familyName);
    this.inviteCode.set(inviteCode);
    this.babies.set(userBabies);

    const savedSelection = localStorage.getItem(`selected_baby_${userId}`);
    if (savedSelection && userBabies.some(b => b.id === savedSelection)) {
      this.selectedBabyId.set(savedSelection);
    } else if (userBabies.length > 0) {
      this.selectedBabyId.set(userBabies[0].id);
    } else {
      this.selectedBabyId.set('');
    }
  }

  addBabyToCurrentUser(newBaby: BabyModel): void {
    const userId = this.currentUserId();
    const updated = [...this.babies(), newBaby];
    this.babies.set(updated);
    this.selectedBabyId.set(newBaby.id);
    if (userId) {
      localStorage.setItem(`selected_baby_${userId}`, newBaby.id);
    }
  }

  removeBabyFromCurrentUser(babyId: string): void {
    const updated = this.babies().filter(b => b.id !== babyId);
    this.babies.set(updated);
    this.selectedBabyId.set(updated[0]?.id ?? '');
  }

  clearSession(): void {
    this.currentUserId.set('');
    this.familyName.set('');
    this.inviteCode.set('');
    this.members.set([]);
    this.babies.set([]);
    this.selectedBabyId.set('');
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
