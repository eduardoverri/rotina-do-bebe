import { Component, inject } from '@angular/core';
import { RoutineStore } from '../../../../core/state/routine.store';
import { OfficialReferenceComponent } from '../../../../shared/components/official-reference/official-reference.component';

@Component({
  selector: 'app-transition-readiness-chart',
  standalone: true,
  imports: [OfficialReferenceComponent],
  template: `
    @if (store.napTransition(); as tr) {
      <div class="card">
        <h3 class="section-title">
          <span aria-hidden="true">📊</span>
          <span>Rotina do Sono e Acompanhamento da Transição de Sonecas</span>
        </h3>

        <div class="card-elevated" style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">MARCO DE TRANSIÇÃO ATUAL</div>
              <div style="font-size: 1.1rem; font-weight: 800; margin-top: 0.15rem;">{{ tr.targetTransition }}</div>
            </div>
            <span class="badge" [class]="tr.isTransitionRecommended ? 'badge-milestone' : 'badge-sleep'">
              <span aria-hidden="true">{{ tr.isTransitionRecommended ? '🔔' : '🛡️' }}</span>
              <span>{{ tr.daysWithResistanceLast10Days }} / {{ tr.requiredConsecutiveDaysThreshold }} dias de resistência</span>
            </span>
          </div>
          <p style="margin-top: 0.6rem; font-size: 0.9rem; color: var(--text-secondary);">
            {{ tr.clinicalRecommendation }}
          </p>
        </div>

        <div class="card-elevated" style="font-size: 0.85rem;">
          <div style="font-weight: 700; margin-bottom: 0.35rem;">🔍 Orientações oficiais sobre rotina, sono e choro</div>
          <ul style="padding-left: 1.2rem; color: var(--text-secondary);">
            <li><strong>Recém-nascido:</strong> o bebê dorme muito e acorda para mamar; a amamentação é em livre demanda (8 a 12 vezes por dia no início), sem horários fixos.</li>
            <li><strong>2 a 4 meses:</strong> crie aos poucos uma rotina das mamadas, do banho e de brincar no tempo em que ela está acordada; isso facilita a regulação das funções fisiológicas do bebê.</li>
            <li><strong>6 a 9 meses:</strong> o bebê já consegue dormir, comer e brincar em uma rotina mais organizada, de acordo com o ritmo da família.</li>
            <li><strong>Choro:</strong> o choro é uma forma normal de expressão (fome, frio, calor, dor ou necessidade de aconchego). Bebês não ficam "viciados em colo": evite deixar a criança chorando sozinha.</li>
            <li><strong>Idade corrigida:</strong> em bebês pré-termo (&lt; 37 semanas), as conquistas são avaliadas pela idade corrigida (idade atual menos o tempo que faltou para completar 40 semanas).</li>
            <li><strong>Distúrbio do sono</strong> pode ser um dos sinais de que a criança sofre violência; converse com o profissional de saúde se algo não vai bem.</li>
          </ul>
          <app-official-reference page="Caderneta da Criança, p. 16 e 26: livre demanda; p. 18: choro; p. 19: idade corrigida; p. 41 e 42: rotina; p. 66: violência" />
        </div>
      </div>
    }
  `
})
export class TransitionReadinessChartComponent {
  readonly store = inject(RoutineStore);
}
