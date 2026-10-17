import { Component, computed, inject, signal } from '@angular/core';
import { RoutineStore } from '../../../../core/state/routine.store';

@Component({
  selector: 'app-breast-timer',
  standalone: true,
  template: `
    <div class="card" style="border-top: 4px solid var(--cat-feeding);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 class="section-title" style="margin-bottom: 0;">
          <span aria-hidden="true">🤱</span>
          <span>Cronômetro Duplo de Amamentação (1-Toque)</span>
        </h3>
        <span class="badge badge-feeding">
          Último lado: {{ store.lastBreastSide() === 'Left' ? 'Esquerdo' : 'Direito' }}
        </span>
      </div>

      <!-- Contador Principal -->
      <div style="text-align: center; margin: 1rem 0;">
        <div style="font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase;">Tempo Total da Mamada</div>
        <div class="mono-timer" style="font-size: 2.8rem; font-weight: 800; color: var(--cat-feeding);">
          {{ totalDurationFormatted() }}
        </div>
      </div>

      <div class="grid-2" style="margin-bottom: 1rem;">
        <!-- Mama Esquerda -->
        <button
          type="button"
          class="btn"
          [style.border-width]="activeSide() === 'Left' ? '3px' : '1px'"
          [style.border-color]="activeSide() === 'Left' ? 'var(--cat-feeding)' : 'var(--border-strong)'"
          style="flex-direction: column; padding: 1.25rem;"
          (click)="toggleSide('Left')">
          <span style="font-size: 0.9rem; color: var(--text-secondary);">Mama Esquerda</span>
          <span class="mono-timer" style="font-size: 1.75rem; font-weight: 800;">{{ leftDurationFormatted() }}</span>
          @if (activeSide() === 'Left') {
            <span class="badge badge-feeding" style="margin-top: 0.35rem;">● Gravando...</span>
          } @else {
            <span style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem;">Toque para iniciar/pausar</span>
          }
        </button>

        <!-- Mama Direita -->
        <button
          type="button"
          class="btn"
          [style.border-width]="activeSide() === 'Right' ? '3px' : '1px'"
          [style.border-color]="activeSide() === 'Right' ? 'var(--cat-feeding)' : 'var(--border-strong)'"
          style="flex-direction: column; padding: 1.25rem;"
          (click)="toggleSide('Right')">
          <span style="font-size: 0.9rem; color: var(--text-secondary);">Mama Direita</span>
          <span class="mono-timer" style="font-size: 1.75rem; font-weight: 800;">{{ rightDurationFormatted() }}</span>
          @if (activeSide() === 'Right') {
            <span class="badge badge-feeding" style="margin-top: 0.35rem;">● Gravando...</span>
          } @else {
            <span style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem;">Toque para iniciar/pausar</span>
          }
        </button>
      </div>

      <!-- Guia de Sinais de Saciedade (Seção 2.1) -->
      <div class="card-elevated" style="font-size: 0.85rem; margin-bottom: 1rem;">
        <div style="font-weight: 700; color: var(--cat-feeding); margin-bottom: 0.3rem;">
          ✅ Marcadores Biológicos de Saciedade (Seção 2.1):
        </div>
        <ul style="padding-left: 1.2rem; color: var(--text-secondary);">
          <li>Punhos que estavam cerrados se abrem relaxados (relaxamento periférico).</li>
          <li>Desprendimento espontâneo do mamilo ou bico.</li>
          <li>Diminuição gradual da sucção e entrada em sonolência tranquila.</li>
        </ul>
      </div>

      <button
        type="button"
        class="btn btn-feeding"
        style="width: 100%;"
        (click)="saveFeedingSession()">
        <span aria-hidden="true">💾</span>
        <span>Concluir e Salvar Mamada</span>
      </button>
    </div>
  `
})
export class BreastTimerComponent {
  readonly store = inject(RoutineStore);

  readonly activeSide = signal<'Left' | 'Right' | 'None'>('None');
  readonly leftSeconds = signal(0);
  readonly rightSeconds = signal(0);
  private timerId?: ReturnType<typeof setInterval>;

  readonly totalDurationFormatted = computed(() => {
    const total = this.leftSeconds() + this.rightSeconds();
    return this.formatSeconds(total);
  });

  readonly leftDurationFormatted = computed(() => this.formatSeconds(this.leftSeconds()));
  readonly rightDurationFormatted = computed(() => this.formatSeconds(this.rightSeconds()));

  toggleSide(side: 'Left' | 'Right'): void {
    if (this.activeSide() === side) {
      this.activeSide.set('None');
      if (this.timerId) clearInterval(this.timerId);
    } else {
      this.activeSide.set(side);
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = setInterval(() => {
        if (this.activeSide() === 'Left') {
          this.leftSeconds.update(s => s + 1);
        } else if (this.activeSide() === 'Right') {
          this.rightSeconds.update(s => s + 1);
        }
      }, 1000);
    }
  }

  async saveFeedingSession(): Promise<void> {
    if (this.timerId) clearInterval(this.timerId);
    const lastSide = this.activeSide() !== 'None' ? this.activeSide() : (this.rightSeconds() >= this.leftSeconds() ? 'Right' : 'Left');
    this.activeSide.set('None');
    await this.store.logQuickBreastfeeding({
      side: lastSide,
      leftDurationSeconds: this.leftSeconds(),
      rightDurationSeconds: this.rightSeconds(),
      hungerCueStage: 'Early',
      satietyCues: ['Relaxamento muscular periférico', 'Desprendimento espontâneo']
    });
  }

  private formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
