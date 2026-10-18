import { Injectable, signal } from '@angular/core';

export type PopupAlertType = 'success' | 'error' | 'warning' | 'info';

export interface PopupAlertItem {
  id: string;
  type: PopupAlertType;
  title: string;
  message: string;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class PopupAlertService {
  readonly alerts = signal<PopupAlertItem[]>([]);

  success(message: string, title = 'Sucesso'): void {
    this.show('success', title, message, 4000);
  }

  error(message: string, title = 'Erro'): void {
    this.show('error', title, message, 7000);
  }

  warning(message: string, title = 'Aviso'): void {
    this.show('warning', title, message, 6000);
  }

  info(message: string, title = 'Informação'): void {
    this.show('info', title, message, 3500);
  }

  show(type: PopupAlertType, title: string, message: string, durationMs = 4500): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: PopupAlertItem = {
      id,
      type,
      title,
      message,
      createdAt: Date.now()
    };

    this.alerts.update(current => [item, ...current].slice(0, 4));

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
}
