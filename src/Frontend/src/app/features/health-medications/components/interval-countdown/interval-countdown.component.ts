import { Component, inject } from '@angular/core';
import { BabyStore } from '../../../../core/state/baby.store';
import { RoutineStore } from '../../../../core/state/routine.store';

@Component({
  selector: 'app-interval-countdown',
  standalone: true,
  template: `
    <details class="card collapsible-card">
      <summary class="collapsible-summary">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1;">
          <span class="section-title" style="margin-bottom: 0;">
            <span aria-hidden="true">⏳</span>
            <span>Suplementação Profilática Contínua (Seção 1.2 — Vitamina D & Ferro)</span>
          </span>
          <span class="badge badge-diaper">{{ babyStore.activeBaby().activeMedications.length }} suplemento(s)</span>
        </div>
      </summary>

      <div class="collapsible-body">
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          @for (med of babyStore.activeBaby().activeMedications; track med.name) {
            <div class="card-elevated" style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <div>
                <div style="font-weight: 800;">{{ med.name }}</div>
                <div style="font-size: 0.84rem; color: var(--text-secondary);">
                  Posologia: {{ med.dose }} • {{ med.frequency }}
                </div>
              </div>
              <button type="button" class="btn btn-diaper" style="min-height: 38px;" (click)="logDailySupplement(med.name, med.dose)">
                <span aria-hidden="true">✅</span>
                <span>Confirmar Dose de Hoje</span>
              </button>
            </div>
          }
        </div>
      </div>
    </details>
  `
})
export class IntervalCountdownComponent {
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);

  async logDailySupplement(name: string, dose: string): Promise<void> {
    await this.routineStore.administerMedication({
      medicationName: name,
      doseMg: 10,
      dosageGiven: dose,
      reason: 'Suplementação profilática diária (SBP)'
    });
  }
}
