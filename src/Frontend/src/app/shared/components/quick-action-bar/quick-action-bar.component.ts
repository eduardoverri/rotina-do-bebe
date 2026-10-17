import { Component, EventEmitter, Output, inject } from '@angular/core';
import { RoutineStore } from '../../../core/state/routine.store';

@Component({
  selector: 'app-quick-action-bar',
  standalone: true,
  template: `
    <nav
      aria-label="Barra de Ação Rápida 1-Toque"
      class="no-print"
      style="position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: var(--bg-surface); border-top: 2px solid var(--border-strong); padding: 0.65rem 1rem; box-shadow: var(--shadow-card);">
      <div style="max-width: 1120px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
          ⚡ Registro Rápido (1-Toque):
        </div>

        <div style="display: flex; gap: 0.5rem; flex: 1; justify-content: flex-end; flex-wrap: wrap;">
          <button
            type="button"
            class="btn btn-feeding quick-bar-btn"
            (click)="quickBreast1Tap()"
            title="Registrar mamada rápida alternando o último seio oferecido">
            <span aria-hidden="true">🤱</span>
            <span>Amamentar ({{ store.lastBreastSide() === 'Left' ? 'Próx: Dir' : 'Próx: Esq' }})</span>
          </button>

          <button
            type="button"
            class="btn btn-sleep quick-bar-btn"
            (click)="quickNap1Tap()"
            title="Registrar soneca padrão no berço">
            <span aria-hidden="true">💤</span>
            <span>Soneca (1 Toque)</span>
          </button>

          <button
            type="button"
            class="btn btn-diaper quick-bar-btn"
            (click)="quickDiaper1Tap()"
            title="Registrar fralda U2 (Urina média com pomada)">
            <span aria-hidden="true">🧷</span>
            <span>Fralda U2</span>
          </button>

          <button
            type="button"
            class="btn btn-health quick-bar-btn"
            (click)="navigateTab.emit('health')"
            title="Abrir calculadora segura de medicação e suplementos">
            <span aria-hidden="true">💊</span>
            <span>Medicação</span>
          </button>
        </div>
      </div>
    </nav>
  `
})
export class QuickActionBarComponent {
  readonly store = inject(RoutineStore);
  @Output() readonly navigateTab = new EventEmitter<string>();

  async quickBreast1Tap(): Promise<void> {
    const nextSide = this.store.lastBreastSide() === 'Left' ? 'Right' : 'Left';
    await this.store.logQuickBreastfeeding({
      side: nextSide,
      leftDurationSeconds: nextSide === 'Left' ? 900 : 0,
      rightDurationSeconds: nextSide === 'Right' ? 900 : 0,
      hungerCueStage: 'Early',
      satietyCues: ['Relaxamento muscular periférico', 'Desprendimento espontâneo']
    });
  }

  async quickNap1Tap(): Promise<void> {
    await this.store.logSleepSession({
      sleepType: 'Nap',
      durationMinutes: 60,
      sleepLocation: 'Crib',
      fallingAsleepMethod: 'Blackout + Ruído Branco',
      sleepQuality: 'Good',
      awakeningsCount: 0,
      hadResistance: false,
      notes: 'Soneca registrada via Barra Rápida 1-Toque.'
    });
  }

  async quickDiaper1Tap(): Promise<void> {
    await this.store.logQuickDiaper({
      code: 'U2',
      volumeLevel: 2,
      barrierCreamApplied: true,
      notes: 'Fralda U2 (Urina média + camada protetora) registrada com 1 toque.'
    });
  }
}
