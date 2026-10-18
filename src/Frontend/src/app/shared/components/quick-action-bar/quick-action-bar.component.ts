import { Component, EventEmitter, Output, inject } from '@angular/core';
import { RoutineStore } from '../../../core/state/routine.store';

@Component({
  selector: 'app-quick-action-bar',
  standalone: true,
  template: `
    <footer
      role="contentinfo"
      aria-label="Rodapé de Registro Rápido 1-Toque"
      class="pwa-bottom-dock no-print">
      <button
        type="button"
        class="quick-icon-btn btn-feeding"
        (click)="quickBreast1Tap()"
        [attr.aria-label]="'Registrar mamada rápida (' + (store.lastBreastSide() === 'Left' ? 'Próximo: Direito' : 'Próximo: Esquerdo') + ')'"
        [title]="'Registrar mamada rápida (' + (store.lastBreastSide() === 'Left' ? 'Próx: Dir' : 'Próx: Esq') + ')'">
        <span aria-hidden="true">🤱</span>
      </button>

      <button
        type="button"
        class="quick-icon-btn btn-sleep"
        (click)="quickNap1Tap()"
        aria-label="Registrar soneca rápida (1 toque)"
        title="Registrar soneca rápida (1 toque)">
        <span aria-hidden="true">💤</span>
      </button>

      <button
        type="button"
        class="quick-icon-btn btn-diaper"
        (click)="quickDiaper1Tap()"
        aria-label="Registrar fralda U2 rápida (1 toque)"
        title="Registrar fralda U2 rápida (1 toque)">
        <span aria-hidden="true">🧷</span>
      </button>

      <button
        type="button"
        class="quick-icon-btn btn-health"
        (click)="navigateTab.emit('health')"
        aria-label="Registrar medicação ou suplemento"
        title="Registrar medicação ou suplemento">
        <span aria-hidden="true">💊</span>
      </button>
    </footer>
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
