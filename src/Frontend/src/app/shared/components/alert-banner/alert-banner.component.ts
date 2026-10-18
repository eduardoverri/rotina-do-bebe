import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PopupAlertService, PopupAlertType } from '../../../core/services/popup-alert.service';

@Component({
  selector: 'app-alert-banner',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (popupService.alerts().length > 0) {
      <div class="popup-overlay-stack no-print" role="region" aria-live="polite" aria-label="Notificações Pop-up">
        @for (alert of popupService.alerts(); track alert.id) {
          <div
            [attr.role]="alert.type === 'error' || alert.type === 'warning' ? 'alert' : 'status'"
            class="popup-alert-card"
            [class.popup-success]="alert.type === 'success'"
            [class.popup-error]="alert.type === 'error'"
            [class.popup-warning]="alert.type === 'warning'"
            [class.popup-info]="alert.type === 'info'">
            <div style="display: flex; align-items: flex-start; gap: 0.65rem; min-width: 0; flex: 1;">
              <span aria-hidden="true" style="font-size: 1.25rem; line-height: 1.2; flex-shrink: 0;">
                {{ getIcon(alert.type) }}
              </span>
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <span style="font-weight: 800; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;">
                    {{ alert.title }}
                  </span>
                  <span style="font-size: 0.7rem; font-weight: 700; opacity: 0.85;">
                    {{ alert.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}
                  </span>
                </div>
                <div style="font-size: 0.86rem; font-weight: 600; margin-top: 0.15rem; word-break: break-word;">
                  {{ alert.message }}
                </div>
              </div>
            </div>

            <button
              type="button"
              class="popup-close-btn"
              (click)="popupService.dismiss(alert.id)"
              aria-label="Fechar alerta pop-up"
              title="Fechar">
              ✕
            </button>
          </div>
        }
      </div>
    }
  `
})
export class AlertBannerComponent {
  readonly popupService = inject(PopupAlertService);

  getIcon(type: PopupAlertType): string {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
    }
  }
}
