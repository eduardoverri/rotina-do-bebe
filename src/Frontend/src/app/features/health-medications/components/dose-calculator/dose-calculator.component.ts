import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BabyStore } from '../../../../core/state/baby.store';
import { RoutineStore } from '../../../../core/state/routine.store';

@Component({
  selector: 'app-dose-calculator',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card" style="border-top: 4px solid var(--cat-health);">
      <h3 class="section-title">
        <span aria-hidden="true">💊</span>
        <span>Motor Farmacológico de Segurança: Dosagem por Peso & Bloqueio de Intervalo</span>
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
        Peso Atual Cadastrado: <strong>{{ weightKg() }} kg</strong> ({{ babyStore.activeBaby().currentWeightGrams }}g) •
        Impede superdosagem e bloqueia administração antes do intervalo mínimo (6h/8h).
      </p>

      <div class="grid-2" style="margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Medicação Aguda</label>
          <select class="input-field" [ngModel]="medicationName()" (ngModelChange)="medicationName.set($event)">
            <option value="Paracetamol Gotas (200mg/mL)">Paracetamol Gotas (200mg/mL) — Int. mín: 6h</option>
            <option value="Dipirona Gotas (500mg/mL)">Dipirona Sódica (500mg/mL) — Int. mín: 6h</option>
            <option value="Ibuprofeno Infantil (100mg/mL)">Ibuprofeno (100mg/mL) — Int. mín: 8h</option>
          </select>
        </div>

        <div>
          <label style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Temperatura Aferida (°C)</label>
          <input type="number" step="0.1" class="input-field" [(ngModel)]="temperature" />
        </div>

        <div>
          <label style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">
            Dose Solicitada (mg) — Limite máx seguro: {{ maxSafeMg() }} mg
          </label>
          <input type="number" class="input-field" [ngModel]="doseMg()" (ngModelChange)="doseMg.set(+$event)" />
        </div>

        <div>
          <label style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Indicação Clínica</label>
          <input type="text" class="input-field" [(ngModel)]="reason" />
        </div>
      </div>

      @if (feedbackMessage()) {
        <div class="card-elevated" style="margin-bottom: 1rem; font-weight: 700;">
          {{ feedbackMessage() }}
        </div>
      }

      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button type="button" class="btn btn-health" style="flex: 1;" (click)="submitDose()">
          <span aria-hidden="true">🛡️</span>
          <span>Validar Segurança e Administrar Dose</span>
        </button>

        <button type="button" class="btn" (click)="simulateOverdoseTest()" title="Simula tentativa de superdosagem para testar bloqueio do MedicationSafetyEngine">
          <span aria-hidden="true">🧪</span>
          <span>Simular Teste de Superdosagem</span>
        </button>
      </div>
    </div>
  `
})
export class DoseCalculatorComponent {
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);

  readonly medicationName = signal('Dipirona Gotas (500mg/mL)');
  readonly doseMg = signal(95);
  temperature = 38.2;
  reason = 'Pico febril / Desconforto gengival';
  readonly feedbackMessage = signal<string | null>(null);

  readonly weightKg = computed(() => +(this.babyStore.activeBaby().currentWeightGrams / 1000).toFixed(2));
  readonly maxSafeMg = computed(() => {
    const isIbu = this.medicationName().toLowerCase().includes('ibuprofeno');
    return +(this.weightKg() * (isIbu ? 10 : 15)).toFixed(1);
  });

  async submitDose(): Promise<void> {
    const res = await this.routineStore.administerMedication({
      medicationName: this.medicationName(),
      doseMg: this.doseMg(),
      dosageGiven: `${this.doseMg()} mg`,
      measuredTemperatureCelsius: this.temperature,
      reason: this.reason
    });
    this.feedbackMessage.set(res.message);
  }

  async simulateOverdoseTest(): Promise<void> {
    this.doseMg.set(250);
    await this.submitDose();
  }
}
