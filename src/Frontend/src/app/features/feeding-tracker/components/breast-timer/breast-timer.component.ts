import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoutineStore } from '../../../../core/state/routine.store';
import { PopupAlertService } from '../../../../core/services/popup-alert.service';

@Component({
  selector: 'app-breast-timer',
  standalone: true,
  imports: [FormsModule],
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

      <button
        type="button"
        class="btn btn-feeding"
        style="width: 100%; margin-bottom: 1.15rem;"
        (click)="saveFeedingSession()">
        <span aria-hidden="true">💾</span>
        <span>Concluir e Salvar Mamada no Peito</span>
      </button>

      <!-- Registro de Mamar Fórmula ou Leite (em Mililitros - mL) -->
      <div class="card-elevated" style="border-top: 3px solid var(--cat-sleep); margin-bottom: 1rem;">
        <h4 style="font-size: 0.92rem; font-weight: 800; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
          <span aria-hidden="true">🍼</span>
          <span>Registrar Fórmula ou Leite (mL)</span>
        </h4>

        <div class="grid-2" style="margin-bottom: 0.75rem;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Tipo de Oferta</label>
            <select
              class="input-field"
              [ngModel]="bottleType()"
              (ngModelChange)="bottleType.set($event)">
              <option value="Formula">Fórmula Infantil</option>
              <option value="ExpressedMilk">Leite (Materno Ordenhado / Leite)</option>
            </select>
          </div>

          <div>
            <label style="font-size: 0.78rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Volume (mL)</label>
            <input
              type="number"
              class="input-field"
              min="5"
              max="500"
              step="5"
              [ngModel]="bottleVolumeMl()"
              (ngModelChange)="bottleVolumeMl.set(+$event)" />
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem;">
          @for (vol of presetVolumes; track vol) {
            <button
              type="button"
              class="btn"
              style="padding: 0.25rem 0.55rem; min-height: 30px; font-size: 0.76rem;"
              [class.btn-sleep]="bottleVolumeMl() === vol"
              (click)="bottleVolumeMl.set(vol)">
              {{ vol }} mL
            </button>
          }
        </div>

        <button
          type="button"
          class="btn btn-sleep"
          style="width: 100%;"
          (click)="saveBottleFeeding()">
          <span aria-hidden="true">🍼</span>
          <span>Registrar {{ bottleType() === 'Formula' ? 'Fórmula' : 'Leite' }} ({{ bottleVolumeMl() }} mL)</span>
        </button>
      </div>

      <!-- Guia de Sinais de Saciedade (Seção 2.1) — Recolhível -->
      <details class="card-elevated collapsible-card" style="font-size: 0.85rem;">
        <summary class="collapsible-summary">
          <span style="font-weight: 700; color: var(--cat-feeding);">
            ✅ Marcadores Biológicos de Saciedade (Seção 2.1)
          </span>
        </summary>
        <div class="collapsible-body">
          <ul style="padding-left: 1.2rem; color: var(--text-secondary);">
            <li>Punhos que estavam cerrados se abrem relaxados (relaxamento periférico).</li>
            <li>Desprendimento espontâneo do mamilo ou bico.</li>
            <li>Diminuição gradual da sucção e entrada em sonolência tranquila.</li>
          </ul>
        </div>
      </details>
    </div>
  `
})
export class BreastTimerComponent {
  readonly store = inject(RoutineStore);
  private readonly popupAlert = inject(PopupAlertService);

  readonly activeSide = signal<'Left' | 'Right' | 'None'>('None');
  readonly leftSeconds = signal(0);
  readonly rightSeconds = signal(0);
  private timerId?: ReturnType<typeof setInterval>;

  readonly bottleType = signal<'Formula' | 'ExpressedMilk'>('Formula');
  readonly bottleVolumeMl = signal<number>(120);
  readonly presetVolumes = [30, 60, 90, 120, 150, 180, 210];

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
    if (this.leftSeconds() <= 0 && this.rightSeconds() <= 0) {
      this.popupAlert.incompleteForm('Inicie o cronômetro em pelo menos uma das mamas antes de salvar a mamada.');
      return;
    }

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
    this.leftSeconds.set(0);
    this.rightSeconds.set(0);
  }

  async saveBottleFeeding(): Promise<void> {
    if (!this.bottleType() || !this.bottleVolumeMl() || this.bottleVolumeMl() <= 0) {
      this.popupAlert.incompleteForm('Informe um volume válido em mililitros (mL) antes de salvar.');
      return;
    }
    await this.store.logBottleFeeding({
      feedingType: this.bottleType(),
      volumeMl: this.bottleVolumeMl()
    });
  }

  private formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
