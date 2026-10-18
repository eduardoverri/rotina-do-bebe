import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BabyStore } from '../../core/state/baby.store';
import { RoutineStore } from '../../core/state/routine.store';
import { BabyAgePipe } from '../../shared/pipes/baby-age.pipe';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-pediatric-report',
  standalone: true,
  imports: [DatePipe, BabyAgePipe, DurationPipe],
  template: `
    @if (babyStore.activeBaby(); as baby) {
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; border-bottom: 2px solid var(--border-strong); padding-bottom: 1rem;">
          <div>
            <span class="badge badge-sleep">RELATÓRIO CLÍNICO CONSOLIDADO PARA CONSULTA PEDIÁTRICA</span>
            <h2 style="font-size: 1.5rem; font-weight: 800; margin-top: 0.35rem;">Paciente: {{ baby.name }}</h2>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">
              Idade: <strong>{{ baby | babyAge }}</strong> • IG ao nascer: {{ baby.gestationalWeeks }}s {{ baby.gestationalDays }}d • Tipo Sanguíneo: {{ baby.bloodType }}
            </p>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Pediatra Responsável: {{ baby.pediatrician.name }} (CRM {{ baby.pediatrician.crm }}) • Tel: {{ baby.pediatrician.emergencyPhone }}
            </p>
          </div>

          <button type="button" class="btn btn-sleep no-print" (click)="printReport()">
            <span aria-hidden="true">🖨️</span>
            <span>Exportar / Imprimir PDF para Consulta</span>
          </button>
        </div>

        <!-- Métricas Consolidadas -->
        <div class="grid-4" style="margin-bottom: 1.25rem;">
          <div class="card-elevated">
            <div style="font-size: 0.76rem; color: var(--text-secondary); font-weight: 700;">PESO & ESTATURA ATUAL</div>
            <div style="font-size: 1.2rem; font-weight: 800; margin-top: 0.25rem;">
              {{ baby.currentWeightGrams }}g • {{ baby.currentHeightCm }} cm
            </div>
            <div style="font-size: 0.8rem; color: var(--cat-diaper);">PC: {{ baby.headCircumferenceCm }} cm (Eutrófico OMS)</div>
          </div>

          <div class="card-elevated">
            <div style="font-size: 0.76rem; color: var(--text-secondary); font-weight: 700;">SONO & JANELA MÉDIA</div>
            <div style="font-size: 1.2rem; font-weight: 800; margin-top: 0.25rem;">
              {{ routineStore.napTransition().averageRealWakeWindowMinutes | duration }}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">{{ routineStore.napCount() }} sonecas diurnas ({{ routineStore.totalSleepMinutes() | duration }})</div>
          </div>

          <div class="card-elevated">
            <div style="font-size: 0.76rem; color: var(--text-secondary); font-weight: 700;">ELIMINAÇÕES / HIDRATAÇÃO</div>
            <div style="font-size: 1.2rem; font-weight: 800; margin-top: 0.25rem;">
              {{ routineStore.urineOrMixedCount() }} Urinas • {{ routineStore.stoolOrMixedCount() }} Evacuações
            </div>
            <div style="font-size: 0.8rem; color: var(--cat-diaper);">Padrão: Pastosa Mostarda</div>
          </div>

          <div class="card-elevated">
            <div style="font-size: 0.76rem; color: var(--text-secondary); font-weight: 700;">INTRODUÇÃO ALIMENTAR</div>
            <div style="font-size: 1.2rem; font-weight: 800; margin-top: 0.25rem;">
              Prato 4 Grupos Ativo
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Alérgenos monitorados: {{ routineStore.allergenTrials().length }}</div>
          </div>
        </div>

        <!-- Curva Antropométrica OMS (Z-Score) -->
        <h3 class="section-title">
          <span aria-hidden="true">📈</span>
          <span>Evolução Antropométrica e Curvas OMS (Z-Score Peso/Idade)</span>
        </h3>
        <div style="overflow-x: auto; margin-bottom: 1rem;">
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
                      Z = {{ g.zScoreWeightForAge > 0 ? '+' + g.zScoreWeightForAge : g.zScoreWeightForAge }} ({{ classifyZScore(g.zScoreWeightForAge) }})
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class PediatricReportComponent {
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);

  classifyZScore(z: number): string {
    if (z < -2) return 'Baixo peso para idade';
    if (z > 2) return 'Peso elevado para idade';
    return 'Normal';
  }

  printReport(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}
