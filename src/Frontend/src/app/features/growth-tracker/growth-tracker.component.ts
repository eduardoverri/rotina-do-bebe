import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BabyStore } from '../../core/state/baby.store';
import { RoutineStore } from '../../core/state/routine.store';
import { BabyAgePipe } from '../../shared/pipes/baby-age.pipe';

@Component({
  selector: 'app-growth-tracker',
  standalone: true,
  imports: [FormsModule, DatePipe, BabyAgePipe],
  template: `
    @if (babyStore.activeBaby(); as baby) {
      <div class="grid-2" style="margin-bottom: 1.25rem;">
        <!-- Formulário de Registro de Nova Aferição Antropométrica & Curvas OMS -->
        <section class="card" style="border-top: 4px solid var(--cat-diaper);">
          <h3 class="section-title">
            <span aria-hidden="true">📈</span>
            <span>Registrar Evolução Antropométrica e Curva OMS</span>
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Paciente: <strong>{{ baby.name }}</strong> ({{ baby | babyAge }}) •
            Atualiza os indicadores antropométricos atuais e adiciona um novo ponto na Curva de Crescimento da OMS.
          </p>

          <div class="grid-2" style="margin-bottom: 0.85rem;">
            <div>
              <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Data da Aferição</label>
              <input
                type="date"
                class="input-field"
                [ngModel]="measuredAtDate()"
                (ngModelChange)="measuredAtDate.set($event)" />
            </div>

            <div>
              <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Peso Aferido (Gramas)</label>
              <input
                type="number"
                class="input-field"
                [ngModel]="weightGrams()"
                (ngModelChange)="weightGrams.set(+$event)"
                min="500"
                max="30000"
                step="10" />
            </div>

            <div>
              <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Comprimento / Estatura (cm)</label>
              <input
                type="number"
                class="input-field"
                [ngModel]="heightCm()"
                (ngModelChange)="heightCm.set(+$event)"
                min="30"
                max="130"
                step="0.1" />
            </div>

            <div>
              <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Perímetro Cefálico (cm)</label>
              <input
                type="number"
                class="input-field"
                [ngModel]="headCircumferenceCm()"
                (ngModelChange)="headCircumferenceCm.set(+$event)"
                min="20"
                max="65"
                step="0.1" />
            </div>
          </div>

          <div class="card-elevated" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="font-size: 0.76rem; color: var(--text-secondary); font-weight: 700;">
                ESCORE-Z OMS ESTIMADO (PESO / IDADE)
              </div>
              <div style="font-size: 1.05rem; font-weight: 800; margin-top: 0.2rem;">
                Z = {{ formatZScore(effectiveZScore()) }} • {{ classifyZScore(effectiveZScore()) }}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem; cursor: pointer;">
                <input
                  type="checkbox"
                  [ngModel]="useCustomZScore()"
                  (ngModelChange)="useCustomZScore.set($event)" />
                <span>Informar Escore-Z manual</span>
              </label>

              @if (useCustomZScore()) {
                <input
                  type="number"
                  step="0.1"
                  min="-4"
                  max="4"
                  class="input-field"
                  style="width: 90px; min-height: 36px; padding: 0.25rem 0.5rem;"
                  [ngModel]="customZScore()"
                  (ngModelChange)="customZScore.set(+$event)" />
              }
            </div>
          </div>

          <button
            type="button"
            class="btn btn-diaper"
            style="width: 100%;"
            [disabled]="weightGrams() <= 0 || heightCm() <= 0 || headCircumferenceCm() <= 0"
            (click)="saveGrowthLog()">
            <span aria-hidden="true">📏</span>
            <span>Salvar Aferição na Evolução Antropométrica</span>
          </button>
        </section>

        <!-- Resumo Atual de Indicadores Antropométricos -->
        <section class="card" style="border-top: 4px solid var(--cat-sleep);">
          <h3 class="section-title">
            <span aria-hidden="true">👶</span>
            <span>Indicadores Antropométricos Atuais</span>
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Referência OMS por sexo biológico (<strong>{{ baby.gender === 'F' ? 'Feminino' : 'Masculino' }}</strong>) e idade corrigida quando prematuro (&lt; 37 semanas).
          </p>

          <div class="grid-2">
            <div class="card-elevated">
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">PESO ATUAL</div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-top: 0.2rem;">
                {{ baby.currentWeightGrams }} g
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
                Ao nascer: {{ baby.birthWeightGrams }} g
              </div>
            </div>

            <div class="card-elevated">
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">COMPRIMENTO ATUAL</div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-top: 0.2rem;">
                {{ baby.currentHeightCm }} cm
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
                Ao nascer: {{ baby.birthLengthCm }} cm
              </div>
            </div>

            <div class="card-elevated">
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">PERÍMETRO CEFÁLICO ATUAL</div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-top: 0.2rem;">
                {{ baby.headCircumferenceCm }} cm
              </div>
              <div style="font-size: 0.78rem; color: var(--cat-diaper); font-weight: 600; margin-top: 0.15rem;">
                Monitoramento craniano ativo
              </div>
            </div>

            <div class="card-elevated">
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">TOTAL DE AFERIÇÕES</div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-top: 0.2rem;">
                {{ baby.growthLogs.length }} registro(s)
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
                Sincronizado com o Relatório Pediátrico
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Tabela de Evolução Antropométrica e Curvas OMS -->
      <section class="card">
        <h3 class="section-title">
          <span aria-hidden="true">📊</span>
          <span>Evolução Antropométrica e Curvas OMS (Z-Score Peso/Idade)</span>
        </h3>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-strong); text-align: left;">
                <th style="padding: 0.55rem;">Data da Aferição</th>
                <th style="padding: 0.55rem;">Peso (g)</th>
                <th style="padding: 0.55rem;">Comprimento (cm)</th>
                <th style="padding: 0.55rem;">Perímetro Cefálico (cm)</th>
                <th style="padding: 0.55rem;">Escore-Z OMS</th>
              </tr>
            </thead>
            <tbody>
              @for (g of baby.growthLogs; track g.measuredAt + '-' + g.weightGrams) {
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.55rem;">{{ g.measuredAt | date:'dd/MM/yyyy' }}</td>
                  <td style="padding: 0.55rem; font-weight: 700;">{{ g.weightGrams }} g</td>
                  <td style="padding: 0.55rem;">{{ g.heightCm }} cm</td>
                  <td style="padding: 0.55rem;">{{ g.headCircumferenceCm }} cm</td>
                  <td style="padding: 0.55rem;">
                    <span class="badge" [class.badge-diaper]="g.zScoreWeightForAge >= -2 && g.zScoreWeightForAge <= 2" [class.badge-milestone]="g.zScoreWeightForAge < -2 || g.zScoreWeightForAge > 2">
                      Z = {{ formatZScore(g.zScoreWeightForAge) }} ({{ classifyZScore(g.zScoreWeightForAge) }})
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `
})
export class GrowthTrackerComponent implements OnInit {
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);

  readonly measuredAtDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly weightGrams = signal<number>(3200);
  readonly heightCm = signal<number>(49);
  readonly headCircumferenceCm = signal<number>(35);
  readonly useCustomZScore = signal<boolean>(false);
  readonly customZScore = signal<number>(0);

  constructor() {
    effect(() => {
      const b = this.babyStore.activeBaby();
      if (b && b.id) {
        this.weightGrams.set(b.currentWeightGrams || 3200);
        this.heightCm.set(b.currentHeightCm || 49);
        this.headCircumferenceCm.set(b.headCircumferenceCm || 35);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const b = this.babyStore.activeBaby();
    if (b && b.id) {
      this.weightGrams.set(b.currentWeightGrams || 3200);
      this.heightCm.set(b.currentHeightCm || 49);
      this.headCircumferenceCm.set(b.headCircumferenceCm || 35);
    }
  }

  readonly calculatedZScore = computed<number>(() => {
    const baby = this.babyStore.activeBaby();
    const measuredAtMs = this.measuredAtDate() ? new Date(this.measuredAtDate()).getTime() : Date.now();
    const birthMs = baby.birthDate ? new Date(baby.birthDate).getTime() : Date.now();
    const chronoDays = Math.max(0, Math.floor((measuredAtMs - birthMs) / 86400000));
    const prematureDays = baby.gestationalWeeks < 37
      ? (40 * 7) - (baby.gestationalWeeks * 7 + baby.gestationalDays)
      : 0;
    const effectiveDays = Math.max(0, chronoDays - prematureDays);

    const months = Math.min(24, Math.max(0, effectiveDays / 30.4375));
    const isFemale = (baby.gender || '').toUpperCase() === 'F';

    const refMonths = [0, 3, 6, 9, 12, 18, 24];
    const medians = isFemale
      ? [3232, 5845, 7297, 8225, 8948, 10231, 11477]
      : [3346, 6376, 7934, 8901, 9647, 10938, 12151];
    const sds = isFemale
      ? [430, 680, 820, 920, 1000, 1140, 1280]
      : [450, 720, 860, 960, 1040, 1180, 1320];

    let i = 0;
    while (i < refMonths.length - 2 && months > refMonths[i + 1]) {
      i++;
    }

    const t = (months - refMonths[i]) / (refMonths[i + 1] - refMonths[i]);
    const median = medians[i] + t * (medians[i + 1] - medians[i]);
    const sd = sds[i] + t * (sds[i + 1] - sds[i]);

    const z = (this.weightGrams() - median) / sd;
    return +Math.min(4, Math.max(-4, z)).toFixed(2);
  });

  readonly effectiveZScore = computed<number>(() =>
    this.useCustomZScore() ? this.customZScore() : this.calculatedZScore()
  );

  formatZScore(z: number): string {
    return z > 0 ? `+${z}` : `${z}`;
  }

  classifyZScore(z: number): string {
    if (z < -2) return 'Baixo peso para idade';
    if (z > 2) return 'Peso elevado para idade';
    return 'Normal';
  }

  async saveGrowthLog(): Promise<void> {
    if (this.weightGrams() <= 0 || this.heightCm() <= 0 || this.headCircumferenceCm() <= 0) return;

    const measuredAtIso = this.measuredAtDate()
      ? new Date(`${this.measuredAtDate()}T12:00:00`).toISOString()
      : new Date().toISOString();

    await this.routineStore.logGrowthMeasurement({
      measuredAt: measuredAtIso,
      weightGrams: this.weightGrams(),
      heightCm: this.heightCm(),
      headCircumferenceCm: this.headCircumferenceCm(),
      zScoreWeightForAge: this.effectiveZScore()
    });
  }
}
