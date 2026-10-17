import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoutineStore } from '../../../../core/state/routine.store';

@Component({
  selector: 'app-nap-stopwatch',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card" style="border-top: 4px solid var(--cat-sleep);">
      <h3 class="section-title">
        <span aria-hidden="true">⏱️</span>
        <span>Cronômetro e Registro de Soneca / Sono Noturno</span>
      </h3>

      <div style="text-align: center; padding: 1rem; background: var(--bg-surface-elevated); border-radius: 16px; margin-bottom: 1rem;">
        <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Duração da Soneca em Andamento</div>
        <div class="mono-timer" style="font-size: 2.6rem; font-weight: 800; color: var(--cat-sleep); margin: 0.35rem 0;">
          {{ formattedElapsed() }}
        </div>
        <div style="display: flex; justify-content: center; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-sleep" (click)="toggleTimer()">
            <span aria-hidden="true">{{ isRunning() ? '⏸️' : '▶️' }}</span>
            <span>{{ isRunning() ? 'Pausar Cronômetro' : 'Iniciar Soneca Agora' }}</span>
          </button>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <label style="font-size: 0.84rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Tipo de Sono</label>
          <select class="input-field" [(ngModel)]="sleepType">
            <option value="Nap">Soneca Diurna (Ciclo 50–90 min)</option>
            <option value="NightSleep">Sono Noturno Consolidado</option>
          </select>
        </div>

        <div>
          <label style="font-size: 0.84rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Duração (Minutos)</label>
          <input type="number" class="input-field" [(ngModel)]="durationMinutes" min="5" max="720" />
        </div>

        <div>
          <label style="font-size: 0.84rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Local do Adormecimento</label>
          <select class="input-field" [(ngModel)]="sleepLocation">
            <option value="Crib">Berço (Seguro, sem objetos soltos)</option>
            <option value="Lap">Colo / Sling</option>
            <option value="Stroller">Carrinho de Passeio</option>
            <option value="CoSleeping">Cama Compartilhada / Co-leito</option>
          </select>
        </div>

        <div>
          <label style="font-size: 0.84rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">Associação / Método de Indução</label>
          <select class="input-field" [(ngModel)]="fallingAsleepMethod">
            <option value="Blackout + Ruído Branco">Autônomo no Berço (Blackout + Ruído Branco)</option>
            <option value="Balanço rítmico no colo">Balanço rítmico no colo</option>
            <option value="Sucção ao seio / mamadeira">Sucção ao seio / mamadeira</option>
            <option value="Chupeta e tapinhas suaves">Chupeta e tapinhas suaves</option>
          </select>
        </div>
      </div>

      <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600; font-size: 0.9rem;">
          <input type="checkbox" [(ngModel)]="hadResistance" style="width: 18px; height: 18px;" />
          <span>Houve resistência intensa (>20 min) para adormecer ou soneca curta (<35 min)</span>
        </label>
      </div>

      <button type="button" class="btn btn-sleep" style="width: 100%; margin-top: 1rem;" (click)="saveSleep()">
        <span aria-hidden="true">💾</span>
        <span>Concluir e Salvar Sessão de Sono</span>
      </button>
    </div>
  `
})
export class NapStopwatchComponent {
  readonly store = inject(RoutineStore);

  readonly isRunning = signal(false);
  readonly elapsedSeconds = signal(0);
  private intervalId?: ReturnType<typeof setInterval>;

  sleepType: 'Nap' | 'NightSleep' = 'Nap';
  durationMinutes = 75;
  sleepLocation = 'Crib';
  fallingAsleepMethod = 'Blackout + Ruído Branco';
  hadResistance = false;

  formattedElapsed(): string {
    const total = this.elapsedSeconds();
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  toggleTimer(): void {
    if (this.isRunning()) {
      this.isRunning.set(false);
      if (this.intervalId) clearInterval(this.intervalId);
      if (this.elapsedSeconds() >= 60) {
        this.durationMinutes = Math.round(this.elapsedSeconds() / 60);
      }
    } else {
      this.isRunning.set(true);
      this.intervalId = setInterval(() => {
        this.elapsedSeconds.update(s => s + 1);
      }, 1000);
    }
  }

  async saveSleep(): Promise<void> {
    if (this.isRunning()) this.toggleTimer();
    await this.store.logSleepSession({
      sleepType: this.sleepType,
      durationMinutes: this.durationMinutes,
      sleepLocation: this.sleepLocation,
      fallingAsleepMethod: this.fallingAsleepMethod,
      sleepQuality: this.hadResistance ? 'Restless' : 'Good',
      awakeningsCount: 0,
      hadResistance: this.hadResistance
    });
    this.elapsedSeconds.set(0);
  }
}
