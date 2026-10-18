import { Component, inject } from '@angular/core';
import { BabyStore } from '../../../../core/state/baby.store';

@Component({
  selector: 'app-vaccine-card',
  standalone: true,
  template: `
    <div class="card" style="margin-top: 1rem;">
      <h3 class="section-title">
        <span aria-hidden="true">💉</span>
        <span>Calendário Vacinal Pediátrico (0 a 24 Meses — PNI / SBP)</span>
      </h3>

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
  `
})
export class VaccineCardComponent {
  readonly babyStore = inject(BabyStore);
}
