import { Component, inject } from '@angular/core';
import { RoutineStore } from '../../../core/state/routine.store';

@Component({
  selector: 'app-alert-banner',
  standalone: true,
  template: `
    @if (store.activeAlertBanner(); as alert) {
      <div
        role="alert"
        class="card"
        style="margin-bottom: 1rem; border-width: 2px; border-color: var(--cat-health); background: var(--cat-health-bg);">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
            <span aria-hidden="true" style="font-size: 1.5rem;">
              {{ alert.level === 'Emergency' ? '🚨' : alert.level === 'Urgent' ? '⚠️' : '🩺' }}
            </span>
            <div>
              <div style="font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em;">
                {{ alert.level === 'Emergency' ? 'Emergência Pediátrica' : alert.level === 'Urgent' ? 'Alerta Clínico Urgente' : 'Aviso Pediátrico' }}
              </div>
              <p style="margin-top: 0.25rem; font-weight: 600;">{{ alert.message }}</p>
            </div>
          </div>
          <button type="button" class="btn" (click)="store.dismissAlertBanner()" aria-label="Fechar alerta clínico">
            <span aria-hidden="true">✖</span>
            <span>Ciente</span>
          </button>
        </div>
      </div>
    }
  `
})
export class AlertBannerComponent {
  readonly store = inject(RoutineStore);
}
