import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoutineStore } from '../../core/state/routine.store';
import { QuickCodePadComponent } from './components/quick-code-pad/quick-code-pad.component';
import { StoolVisualPickerComponent } from './components/stool-visual-picker/stool-visual-picker.component';

@Component({
  selector: 'app-diapers-tracker',
  standalone: true,
  imports: [FormsModule, QuickCodePadComponent, StoolVisualPickerComponent],
  template: `
    <div class="card" style="border-top: 4px solid var(--cat-diaper);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
        <div>
          <h3 class="section-title" style="margin-bottom: 0.15rem;">
            <span aria-hidden="true">🧷</span>
            <span>Registro Rápido de Fraldas e Prevenção de Dermatites (Seção 4)</span>
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Código Selecionado: <strong class="mono-timer" style="font-size: 1.05rem;">{{ state }}{{ volume }}</strong>
            • {{ store.hydrationStatusMessage() }}
          </p>
        </div>
        <span class="badge badge-diaper">
          {{ store.totalDiaperChanges() }} trocas registradas hoje
        </span>
      </div>

      <app-quick-code-pad
        [selectedState]="state"
        [selectedVolume]="volume"
        (selectState)="state = $event"
        (selectVolume)="volume = $event" />

      @if (state === 'E' || state === 'M') {
        <app-stool-visual-picker
          [selectedColor]="stoolColor"
          [selectedConsistency]="stoolConsistency"
          (selectColor)="stoolColor = $event"
          (selectConsistency)="stoolConsistency = $event" />
      }

      <div class="card-elevated" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: center;">
        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; cursor: pointer;">
          <input type="checkbox" [(ngModel)]="barrierCreamApplied" style="width: 18px; height: 18px;" />
          <span>✅ Pomada de barreira aplicada (Óxido de zinco / Petrolato — Seção 4.2)</span>
        </label>

        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; cursor: pointer;">
          <input type="checkbox" [(ngModel)]="hasBlood" style="width: 18px; height: 18px;" />
          <span>⚠️ Presença visível de raias de sangue ou muco</span>
        </label>
      </div>

      <button type="button" class="btn btn-diaper" style="width: 100%; font-size: 1rem;" (click)="saveDiaper()">
        <span aria-hidden="true">💾</span>
        <span>SALVAR FRALDA ({{ state }}{{ volume }}) — 1 TOQUE</span>
      </button>
    </div>
  `
})
export class DiapersTrackerComponent {
  readonly store = inject(RoutineStore);

  state = 'M';
  volume = 2;
  stoolColor = 'Mustard';
  stoolConsistency = 'MoldedPastous';
  barrierCreamApplied = true;
  hasBlood = false;

  async saveDiaper(): Promise<void> {
    await this.store.logQuickDiaper({
      code: `${this.state}${this.volume}`,
      volumeLevel: this.volume,
      stoolColor: this.state === 'E' || this.state === 'M' ? this.stoolColor : undefined,
      stoolConsistency: this.state === 'E' || this.state === 'M' ? this.stoolConsistency : undefined,
      hasBlood: this.hasBlood || this.stoolColor === 'RedBlood',
      barrierCreamApplied: this.barrierCreamApplied
    });
  }
}
