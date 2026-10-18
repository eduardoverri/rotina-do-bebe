import { Component, inject } from '@angular/core';
import { RoutineStore } from '../../../../core/state/routine.store';
import { DurationPipe } from '../../../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-daily-summary-cards',
  standalone: true,
  imports: [DurationPipe],
  template: `
    <div class="grid-3" style="margin: 1rem 0;">
      <!-- Card 1: Última Mamada / Nutrição -->
      <details class="card collapsible-card" style="border-top: 4px solid var(--cat-feeding);">
        <summary class="collapsible-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex: 1; flex-wrap: wrap;">
            <span class="badge badge-feeding">
              <span aria-hidden="true">🤱</span>
              <span>ÚLTIMA ALIMENTAÇÃO</span>
            </span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">Próx. peito: {{ store.lastBreastSide() === 'Left' ? 'Direito' : 'Esquerdo' }}</span>
          </div>
        </summary>
        <div class="collapsible-body">
          <div style="font-size: 1.15rem; font-weight: 800;">
            {{ store.lastFeedingSummary() }}
          </div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
            Livre demanda / Prato 4 Grupos ativo
          </div>
        </div>
      </details>

      <!-- Card 2: Última Fralda & Hidratação -->
      <details class="card collapsible-card" style="border-top: 4px solid var(--cat-diaper);">
        <summary class="collapsible-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex: 1; flex-wrap: wrap;">
            <span class="badge badge-diaper">
              <span aria-hidden="true">🧷</span>
              <span>FRALDAS & HIDRATAÇÃO</span>
            </span>
            <span style="font-size: 0.78rem; font-weight: 700;">{{ store.totalDiaperChanges() }} trocas hoje</span>
          </div>
        </summary>
        <div class="collapsible-body">
          <div style="font-size: 1.15rem; font-weight: 800;">
            {{ store.lastDiaperSummary() }}
          </div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
            @if (store.isLowHydrationAlert()) {
              <span aria-hidden="true">⚠️</span> {{ store.hydrationStatusMessage() }}
            } @else {
              <span aria-hidden="true">✅</span> {{ store.urineOrMixedCount() }} urinas • {{ store.stoolOrMixedCount() }} evacuações (Pele íntegra)
            }
          </div>
        </div>
      </details>

      <!-- Card 3: Sonecas Consolidadas -->
      <details class="card collapsible-card" style="border-top: 4px solid var(--cat-sleep);">
        <summary class="collapsible-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex: 1; flex-wrap: wrap;">
            <span class="badge badge-sleep">
              <span aria-hidden="true">💤</span>
              <span>SONO ACUMULADO</span>
            </span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">Meta: {{ store.expectedNaps() }} sonecas</span>
          </div>
        </summary>
        <div class="collapsible-body">
          <div style="font-size: 1.15rem; font-weight: 800;">
            {{ store.napCount() }} de {{ store.expectedNaps() }} sonecas ({{ store.totalSleepMinutes() | duration }})
          </div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
            Janela média real: {{ store.napTransition().averageRealWakeWindowMinutes | duration }}
          </div>
        </div>
      </details>
    </div>
  `
})
export class DailySummaryCardsComponent {
  readonly store = inject(RoutineStore);
}
