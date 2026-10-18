import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoutineStore } from '../../../../core/state/routine.store';
import { PopupAlertService } from '../../../../core/services/popup-alert.service';

@Component({
  selector: 'app-allergen-monitor',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (mode === 'all' || mode === 'form') {
      <div class="card" style="border-top: 4px solid var(--cat-milestone);">
        <h3 class="section-title">
          <span aria-hidden="true">🥜</span>
          <span>Iniciar Monitoramento de Novo Alérgeno — Janela de 72 Horas (Seção 2.2)</span>
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Regra de ouro: Introduzir 1 novo alérgeno por vez no período diurno e monitorar por 48 a 72 horas.
        </p>

        <div class="grid-3">
          <select class="input-field" [(ngModel)]="newAllergenName">
            <option value="Ovo Cozido (Gema e Clara)">Ovo Cozido (Gema e Clara)</option>
            <option value="Peixe (Filé sem espinhas)">Peixe (Filé sem espinhas)</option>
            <option value="Pasta de Amendoim 100% Integral">Pasta de Amendoim (Diluída)</option>
            <option value="Trigo / Glúten">Trigo / Glúten</option>
            <option value="Iogurte Natural (Proteína do Leite)">Iogurte Natural (APLV)</option>
          </select>
          <input type="text" class="input-field" [(ngModel)]="initialDose" placeholder="Quantidade (ex: 1/4 colher de chá)" />
          <button type="button" class="btn btn-milestone" (click)="startTrial()">
            <span aria-hidden="true">⏱️</span>
            <span>Iniciar Janela 72h</span>
          </button>
        </div>
      </div>
    }

    @if (mode === 'all' || mode === 'list') {
      <details class="card collapsible-card" style="border-top: 4px solid var(--cat-milestone);">
        <summary class="collapsible-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1;">
            <span class="section-title" style="margin-bottom: 0;">
              <span aria-hidden="true">🥜</span>
              <span>Lista de Alérgenos Monitorados — Janela de 72 Horas</span>
            </span>
            <span class="badge badge-milestone">{{ store.allergenTrials().length }} alérgeno(s)</span>
          </div>
        </summary>

        <div class="collapsible-body">
          @if (store.allergenTrials().length === 0) {
            <div class="card-elevated" style="text-align: center; padding: 1.25rem; color: var(--text-secondary); font-size: 0.86rem;">
              Nenhum alérgeno em monitoramento para este bebê.
            </div>
          } @else {
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              @for (item of store.allergenTrials(); track item.trial.id) {
                <div class="card-elevated">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                      <div style="font-weight: 800; font-size: 1rem;">{{ item.trial.foodName }}</div>
                      <div style="font-size: 0.8rem; color: var(--text-secondary);">{{ item.evaluation.clinicalGuidance }}</div>
                    </div>
                    <span class="badge" [class]="item.evaluation.hasAlertSymptoms ? 'badge-health' : item.trial.status === 'SafeCompleted' ? 'badge-diaper' : 'badge-milestone'">
                      @if (item.evaluation.hasAlertSymptoms) {
                        <span aria-hidden="true">🚨</span> Reação Reportada
                      } @else if (item.trial.status === 'SafeCompleted') {
                        <span aria-hidden="true">✅</span> Seguro (72h Concluídas)
                      } @else {
                        <span aria-hidden="true">⏳</span> {{ item.evaluation.remainingHours }}h restantes
                      }
                    </span>
                  </div>

                  <!-- Checklist de Sinais de Alerta da Seção 2.2 -->
                  @if (item.trial.status === 'MonitoringActive') {
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); font-size: 0.84rem;">
                      <div style="font-weight: 700; margin-bottom: 0.4rem;">Reportar Sinais de Alerta Imediatos ou Tardios:</div>
                      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        <button type="button" class="btn" style="min-height: 34px; font-size: 0.8rem;" (click)="reportSymptom(item.trial.id, 'hives')">
                          🔴 Urticária / Placas na pele
                        </button>
                        <button type="button" class="btn" style="min-height: 34px; font-size: 0.8rem;" (click)="reportSymptom(item.trial.id, 'swelling')">
                          🚨 Inchaço em lábios/olhos
                        </button>
                        <button type="button" class="btn" style="min-height: 34px; font-size: 0.8rem;" (click)="reportSymptom(item.trial.id, 'vomiting')">
                          ⚠️ Vômitos agudos / Diarreia
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </details>
    }
  `
})
export class AllergenMonitorComponent {
  @Input() mode: 'all' | 'form' | 'list' = 'all';

  readonly store = inject(RoutineStore);
  private readonly popupAlert = inject(PopupAlertService);
  newAllergenName = 'Ovo Cozido (Gema e Clara)';
  initialDose = '';

  async startTrial(): Promise<void> {
    if (!this.newAllergenName.trim() || !this.initialDose.trim()) {
      this.popupAlert.incompleteForm(
        'Informe o alérgeno e a quantidade inicial ofertada para iniciar o monitoramento de 72h.'
      );
      return;
    }

    await this.store.startAllergenTrial({
      foodName: this.newAllergenName,
      foodCategory: 'Alérgeno Principal (Oferta Diurna)',
      initialQuantityOffered: this.initialDose.trim()
    });
    this.initialDose = '';
  }

  async reportSymptom(trialId: string, type: 'hives' | 'swelling' | 'vomiting'): Promise<void> {
    await this.store.updateAllergenSymptoms(trialId, {
      hivesOrRash: type === 'hives',
      facialSwelling: type === 'swelling',
      acuteVomiting: type === 'vomiting',
      explosiveDiarrhea: type === 'vomiting',
      wheezing: false
    });
  }
}
