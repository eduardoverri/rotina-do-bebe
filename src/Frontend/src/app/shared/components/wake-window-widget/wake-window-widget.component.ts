import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RoutineStore } from '../../../core/state/routine.store';
import { WakeWindowTimerService } from '../../../core/services/wake-window-timer.service';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-wake-window-widget',
  standalone: true,
  imports: [DatePipe, DurationPipe],
  template: `
    @if (store.wakeWindowStatus(); as ww) {
      <details class="card collapsible-card" style="border-left: 5px solid var(--cat-sleep);">
        <summary class="collapsible-summary">
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; flex: 1;">
            <span class="section-title" style="margin-bottom: 0;">
              <span aria-hidden="true">💤</span>
              <span>Status Atual da Janela de Vigília</span>
            </span>

            <div>
              @if (ww.alertLevel === 'Optimal') {
                <span class="badge badge-diaper">
                  <span aria-hidden="true">✨</span>
                  <span>SWEET SPOT DE SONO AGORA</span>
                </span>
              } @else if (ww.alertLevel === 'Overdue') {
                <span class="badge badge-health">
                  <span aria-hidden="true">⚠️</span>
                  <span>JANELA ULTRAPASSADA</span>
                </span>
              } @else {
                <span class="badge badge-sleep">
                  <span aria-hidden="true">⏳</span>
                  <span>SWEET SPOT EM {{ timer.remainingToSweetSpotMinutes() | duration }}</span>
                </span>
              }
            </div>
          </div>
        </summary>

        <div class="collapsible-body">
          <div style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem;">
            Acordado há: <span class="mono-timer">{{ timer.awakeMinutes() | duration }}</span>
            <span style="font-size: 0.88rem; font-weight: 500; color: var(--text-secondary);">
              (Janela fisiológica: {{ ww.minWindowMinutes | duration }} – {{ ww.maxWindowMinutes | duration }})
            </span>
          </div>

          <!-- Barra de Progresso Visual com Marcador de Sweet Spot -->
          <div style="background: var(--bg-surface-muted); height: 16px; border-radius: 999px; overflow: hidden; border: 1px solid var(--border-subtle); margin: 0.75rem 0;">
            <div
              [style.width.%]="timer.progressPercent()"
              [style.background]="ww.alertLevel === 'Overdue' ? 'var(--cat-health)' : ww.alertLevel === 'Optimal' ? 'var(--cat-diaper)' : 'var(--cat-sleep)'"
              style="height: 100%; transition: width 0.4s ease;">
            </div>
          </div>

          <div class="grid-2" style="margin-top: 0.75rem; font-size: 0.9rem;">
            <div class="card-elevated">
              <div style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 600;">PREVISÃO DO PRÓXIMO ADORMECIMENTO</div>
              <div style="font-weight: 700; font-size: 1.05rem; margin-top: 0.2rem;">
                🎯 Horário Ideal: {{ ww.idealSleepTime | date:'HH:mm' }} (Máx: {{ ww.maxSleepTime | date:'HH:mm' }})
              </div>
              <div style="color: var(--text-muted); font-size: 0.82rem; margin-top: 0.2rem;">{{ ww.stageDescription }}</div>
            </div>

            <div class="card-elevated">
              <div style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 600;">AMBIENTE E CONDUTA SUGERIDA</div>
              <div style="font-weight: 600; margin-top: 0.2rem;">{{ ww.environmentSuggestion }}</div>
            </div>
          </div>
        </div>
      </details>
    }
  `
})
export class WakeWindowWidgetComponent {
  readonly store = inject(RoutineStore);
  readonly timer = inject(WakeWindowTimerService);
}
