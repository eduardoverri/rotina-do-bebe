import { Component, inject } from '@angular/core';
import { BabyStore } from '../../../../core/state/baby.store';
import { RoutineStore } from '../../../../core/state/routine.store';
import { BabyAgePipe } from '../../../../shared/pipes/baby-age.pipe';

@Component({
  selector: 'app-milestone-timeline-tree',
  standalone: true,
  imports: [BabyAgePipe],
  template: `
    <details class="card collapsible-card" style="border-top: 4px solid var(--cat-milestone);">
      <summary class="collapsible-summary">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; flex: 1;">
          <span class="section-title" style="margin-bottom: 0;">
            <span aria-hidden="true">🏆</span>
            <span>Linha do Tempo do Desenvolvimento Motor (0 a 24 Meses — Seção 5)</span>
          </span>

          <span class="badge badge-milestone">
            <span aria-hidden="true">👶</span>
            <span>Idade Avaliada: {{ babyStore.activeBaby() | babyAge }}</span>
          </span>
        </div>
      </summary>

      <div class="collapsible-body">
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Progressão biológica <strong>Cefalocaudal</strong> (cabeça → membros inferiores) e <strong>Próximo-Distal</strong> (tronco → pinça fina).
        </p>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          @for (m of routineStore.milestones(); track m.milestoneCode) {
            <div class="card-elevated" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 260px;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.3rem;">
                  <span class="badge badge-milestone">{{ m.ageRangeLabel }}</span>
                  <span class="badge">
                    {{ m.directionType === 'Cephalocaudal' ? '⬇️ Direção Cefalocaudal' : '↔️ Direção Próximo-Distal' }}
                  </span>
                </div>
                <div style="font-weight: 800; font-size: 1.02rem;">{{ m.title }}</div>
                <p style="font-size: 0.86rem; color: var(--text-secondary); margin-top: 0.2rem;">{{ m.description }}</p>
                @if (m.notes) {
                  <p style="font-size: 0.82rem; color: var(--cat-diaper); font-weight: 600; margin-top: 0.3rem;">
                    📝 {{ m.notes }}
                  </p>
                }
              </div>

              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <button
                  type="button"
                  class="btn"
                  style="min-height: 36px; font-size: 0.8rem;"
                  [class.btn-diaper]="m.status === 'Achieved'"
                  (click)="routineStore.updateMilestoneStatus(m.milestoneCode, 'Achieved')">
                  <span aria-hidden="true">✅</span>
                  <span>Alcançado</span>
                </button>

                <button
                  type="button"
                  class="btn"
                  style="min-height: 36px; font-size: 0.8rem;"
                  [class.btn-milestone]="m.status === 'InProgress'"
                  (click)="routineStore.updateMilestoneStatus(m.milestoneCode, 'InProgress')">
                  <span aria-hidden="true">⏳</span>
                  <span>Em Progresso</span>
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </details>
  `
})
export class MilestoneTimelineTreeComponent {
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);
}
