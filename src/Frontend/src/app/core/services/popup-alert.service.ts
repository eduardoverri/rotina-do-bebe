import { Injectable, computed, inject, signal } from '@angular/core';
import { BabyStore } from '../state/baby.store';

export type PopupAlertType = 'success' | 'error' | 'warning' | 'info';

export interface PopupAlertItem {
  id: string;
  babyId?: string;
  type: PopupAlertType;
  title: string;
  message: string;
  createdAt: number;
}

export interface PopupAlertOptions {
  skipHistory?: boolean;
  babyId?: string;
}

@Injectable({ providedIn: 'root' })
export class PopupAlertService {
  private readonly babyStore = inject(BabyStore);
  private readonly storageKey = 'baby_routine_alerts_history_v1';
  private readonly maxAlertsPerBaby = 100;

  readonly alerts = signal<PopupAlertItem[]>([]);
  readonly historyByBaby = signal<Record<string, PopupAlertItem[]>>(this.loadHistoryFromStorage());

  readonly activeBabyAlerts = computed<PopupAlertItem[]>(() => {
    const babyId = this.babyStore.selectedBabyId();
    if (!babyId) return [];
    return this.historyByBaby()[babyId] ?? [];
  });

  success(message: string, title = 'Sucesso', options?: PopupAlertOptions): void {
    this.show('success', title, message, 4000, options);
  }

  error(message: string, title = 'Erro', options?: PopupAlertOptions): void {
    this.show('error', title, message, 7000, options);
  }

  warning(message: string, title = 'Aviso', options?: PopupAlertOptions): void {
    this.show('warning', title, message, 6000, options);
  }

  info(message: string, title = 'Informação', options?: PopupAlertOptions): void {
    this.show('info', title, message, 3500, options);
  }

  incompleteForm(
    message = 'Preencha todos os campos obrigatórios do formulário antes de continuar.',
    title = 'Formulário Incompleto'
  ): void {
    this.warning(message, title, { skipHistory: true });
  }

  show(
    type: PopupAlertType,
    title: string,
    message: string,
    durationMs = 4500,
    options?: PopupAlertOptions
  ): void {
    const targetBabyId = options?.babyId ?? this.babyStore.selectedBabyId();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: PopupAlertItem = {
      id,
      babyId: targetBabyId || undefined,
      type,
      title,
      message,
      createdAt: Date.now()
    };

    this.alerts.update(current => [item, ...current].slice(0, 4));

    if (!options?.skipHistory && targetBabyId) {
      this.historyByBaby.update(map => {
        const existing = map[targetBabyId] ?? [];
        const updatedList = [item, ...existing].slice(0, this.maxAlertsPerBaby);
        const nextMap = { ...map, [targetBabyId]: updatedList };
        this.saveHistoryToStorage(nextMap);
        return nextMap;
      });
    }

    if (durationMs > 0 && typeof window !== 'undefined') {
      setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
    }
  }

  dismiss(id: string): void {
    this.alerts.update(current => current.filter(a => a.id !== id));
  }

  clearAll(): void {
    this.alerts.set([]);
  }

  clearHistoryForBaby(babyId: string): void {
    if (!babyId) return;
    this.historyByBaby.update(map => {
      const nextMap = { ...map };
      delete nextMap[babyId];
      this.saveHistoryToStorage(nextMap);
      return nextMap;
    });
  }

  private loadHistoryFromStorage(): Record<string, PopupAlertItem[]> {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, PopupAlertItem[]>;
    } catch {
      return {};
    }
  }

  private saveHistoryToStorage(map: Record<string, PopupAlertItem[]>): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(map));
      }
    } catch {}
  }
}
