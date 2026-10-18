import { Component, inject } from '@angular/core';
import { BabyStore } from '../../../../core/state/baby.store';

@Component({
  selector: 'app-vaccine-card',
  standalone: true,
  template: `
    <details class="card collapsible-card">
      <summary class="collapsible-summary">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1;">
          <span class="section-title" style="margin-bottom: 0;">
            <span aria-hidden="true">💉</span>
            <span>Calendário Vacinal Pediátrico (0 a 24 Meses — PNI / SBP)</span>
          </span>
          <span class="badge badge-sleep">{{ babyStore.activeBaby().vaccines.length }} vacina(s)</span>
        </div>
      </summary>

      <div class="collapsible-body">
        <div class="grid-2">
          @for (vac of babyStore.activeBaby().vaccines; track vac.code) {
            <div class="card-elevated" style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
              <div>
                <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 700;">{{ vac.recommendedMonth }} MESES</div>
                <div style="font-weight: 700; font-size: 0.92rem;">{{ vac.name }}</div>
              </div>
              <span class="badge" [class]="vac.status === 'Applied' ? 'badge-diaper' : 'badge-milestone'">
                <span aria-hidden="true">{{ vac.status === 'Applied' ? '✅' : '🗓️' }}</span>
                <span>{{ vac.status === 'Applied' ? 'Aplicada' : 'Agendada' }}</span>
              </span>
            </div>
          }
        </div>
      </div>
    </details>
  `
})
export class VaccineCardComponent {
  readonly babyStore = inject(BabyStore);
}
