import { Component, inject } from '@angular/core';
import { RoutineStore } from '../../../../core/state/routine.store';

@Component({
  selector: 'app-transition-readiness-chart',
  standalone: true,
  template: `
    @if (store.napTransition(); as tr) {
      <details class="card collapsible-card">
        <summary class="collapsible-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1;">
            <span class="section-title" style="margin-bottom: 0;">
              <span aria-hidden="true">📊</span>
              <span>Análise de Transição de Sonecas e Causas de Despertares (Seções 3.2 e 6.1)</span>
            </span>
            <span class="badge" [class]="tr.isTransitionRecommended ? 'badge-milestone' : 'badge-sleep'">
              <span aria-hidden="true">{{ tr.isTransitionRecommended ? '🔔' : '🛡️' }}</span>
              <span>{{ tr.daysWithResistanceLast10Days }} / {{ tr.requiredConsecutiveDaysThreshold }} dias de resistência</span>
            </span>
          </div>
        </summary>

        <div class="collapsible-body">
          <div class="card-elevated" style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">MARCO DE TRANSIÇÃO ATUAL</div>
                <div style="font-size: 1.1rem; font-weight: 800; margin-top: 0.15rem;">{{ tr.targetTransition }}</div>
              </div>
            </div>
            <p style="margin-top: 0.6rem; font-size: 0.9rem; color: var(--text-secondary);">
              {{ tr.clinicalRecommendation }}
            </p>
          </div>

          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">
            Tabela de Referência de Janelas de Vigília e Transições (0 a 24 Meses)
          </h4>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-strong); text-align: left;">
                  <th style="padding: 0.5rem;">Faixa Etária</th>
                  <th style="padding: 0.5rem;">Janela de Vigília</th>
                  <th style="padding: 0.5rem;">Sonecas/Dia</th>
                  <th style="padding: 0.5rem;">Marco Fisiológico</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.5rem; font-weight: 700;">0 a 1 mês (RN)</td>
                  <td style="padding: 0.5rem;">45 a 60 min</td>
                  <td style="padding: 0.5rem;">4 a 5</td>
                  <td style="padding: 0.5rem;">Ritmo ultradiano, predomínio do sono ativo (REM)</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.5rem; font-weight: 700;">1 a 2 meses</td>
                  <td style="padding: 0.5rem;">60 a 90 min</td>
                  <td style="padding: 0.5rem;">4</td>
                  <td style="padding: 0.5rem;">Ciclos curtos de 50 a 60 minutos</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.5rem; font-weight: 700;">3 a 4 meses</td>
                  <td style="padding: 0.5rem;">75 a 120 min</td>
                  <td style="padding: 0.5rem;">3 a 4</td>
                  <td style="padding: 0.5rem;">Início da consolidação circadiana pela melatonina</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.5rem; font-weight: 700;">4 a 5 meses</td>
                  <td style="padding: 0.5rem;">1h30 a 2h30</td>
                  <td style="padding: 0.5rem;">4 → 3</td>
                  <td style="padding: 0.5rem;">1ª Transição de Sonecas</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.5rem; font-weight: 700;">7 a 9 meses</td>
                  <td style="padding: 0.5rem;">2h00 a 3h00</td>
                  <td style="padding: 0.5rem;">3 → 2</td>
                  <td style="padding: 0.5rem;">2ª Transição de Sonecas (Manhã e Pós-Almoço)</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem; font-weight: 700;">14 a 18 meses</td>
                  <td style="padding: 0.5rem;">4h00 a 5h30</td>
                  <td style="padding: 0.5rem;">2 → 1</td>
                  <td style="padding: 0.5rem;">Soneca única consolidada após o almoço</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card-elevated" style="margin-top: 1rem; font-size: 0.85rem;">
            <div style="font-weight: 700; margin-bottom: 0.35rem;">🔍 Diagnóstico Diferencial de Despertares Noturnos (Seção 3.2):</div>
            <ul style="padding-left: 1.2rem; color: var(--text-secondary);">
              <li><strong>Fome Real vs. Hábito:</strong> Mamadas longas e efetivas indicam fome biológica; sucções de 2–3 min indicam associação para religar ciclos.</li>
              <li><strong>Saltos Motores e Dentição:</strong> Aquisição de sinapses (rolar, sentar, engatinhar) e inflamação gengival aumentam microdespertares.</li>
            </ul>
          </div>
        </div>
      </details>
    }
  `
})
export class TransitionReadinessChartComponent {
  readonly store = inject(RoutineStore);
}
