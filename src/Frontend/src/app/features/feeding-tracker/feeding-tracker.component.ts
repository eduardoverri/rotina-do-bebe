import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RoutineEventModel, RoutineStore } from '../../core/state/routine.store';
import { BreastTimerComponent } from './components/breast-timer/breast-timer.component';
import { SolidsPlateSelectorComponent } from './components/solids-plate-selector/solids-plate-selector.component';
import { AllergenMonitorComponent } from './components/allergen-monitor/allergen-monitor.component';
import { HungerCuesGuideComponent } from './components/hunger-cues-guide/hunger-cues-guide.component';

@Component({
  selector: 'app-feeding-tracker',
  standalone: true,
  imports: [
    DatePipe,
    BreastTimerComponent,
    SolidsPlateSelectorComponent,
    AllergenMonitorComponent,
    HungerCuesGuideComponent
  ],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <!-- 1. Formulários no início -->
      <div class="grid-2">
        <app-breast-timer />
        <app-solids-plate-selector />
      </div>

      <app-allergen-monitor mode="form" />

      <!-- 2. Caixa informativa recolhível -->
      <app-hunger-cues-guide />

      <!-- 3. Listas recolhíveis ao final -->
      <app-allergen-monitor mode="list" />

      <!-- Lista das Últimas Refeições e Mamadas (Recolhível ao final) -->
      <details class="card collapsible-card" style="border-top: 4px solid var(--cat-feeding);">
        <summary class="collapsible-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1;">
            <span class="section-title" style="margin-bottom: 0;">
              <span aria-hidden="true">🍽️</span>
              <span>Últimas Refeições e Mamadas Registradas</span>
            </span>
            <span class="badge badge-feeding">{{ feedingEvents().length }} registro(s)</span>
          </div>
        </summary>

        <div class="collapsible-body">
          @if (feedingEvents().length === 0) {
            <div class="card-elevated" style="text-align: center; padding: 1.25rem; color: var(--text-secondary); font-size: 0.86rem;">
              Nenhuma refeição ou mamada registrada ainda para este bebê.
            </div>
          } @else {
            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              @for (ev of feedingEvents(); track ev.id) {
                <div class="card-elevated" style="border-left: 4px solid var(--cat-feeding);">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;">
                      <span aria-hidden="true">{{ getFeedingIcon(ev) }}</span>
                      <span>{{ getFeedingTitle(ev) }}</span>
                    </div>
                    <span style="font-size: 0.76rem; color: var(--text-secondary); font-weight: 700;">
                      {{ ev.timestamp | date:'dd/MM/yyyy HH:mm' }}
                    </span>
                  </div>

                  @if (ev.details.feedingType === 'Solids' && ev.details.solidsDetails; as solids) {
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.2rem;">
                      <div>
                        <strong>Aceitação:</strong> {{ formatAcceptance(solids.acceptanceLevel) }} •
                        <strong>Método:</strong> {{ formatAutonomy(solids.eatingAutonomy) }}
                      </div>
                      @if (solids.foodGroups.fruitsAndVegetables.length > 0) {
                        <div>🥦 <strong>Frutas/Hortaliças:</strong> {{ solids.foodGroups.fruitsAndVegetables.join(', ') }}</div>
                      }
                      @if (solids.foodGroups.cerealsAndTubers.length > 0) {
                        <div>🥔 <strong>Cereais/Tubérculos:</strong> {{ solids.foodGroups.cerealsAndTubers.join(', ') }}</div>
                      }
                      @if (solids.foodGroups.legumes.length > 0) {
                        <div>🫘 <strong>Leguminosas:</strong> {{ solids.foodGroups.legumes.join(', ') }}</div>
                      }
                      @if (solids.foodGroups.animalProtein.length > 0) {
                        <div>🥩 <strong>Proteínas Animais:</strong> {{ solids.foodGroups.animalProtein.join(', ') }}</div>
                      }
                    </div>
                  } @else if (ev.details.feedingType === 'Breast' && ev.details.breastfeedingDetails) {
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.3rem;">
                      Esquerda: <strong>{{ formatSec(ev.details.breastfeedingDetails.leftDurationSeconds) }}</strong> •
                      Direita: <strong>{{ formatSec(ev.details.breastfeedingDetails.rightDurationSeconds) }}</strong> •
                      Último lado: <strong>{{ ev.details.breastfeedingDetails.lastSideOffered === 'Left' ? 'Esquerdo' : 'Direito' }}</strong>
                    </div>
                  } @else if (ev.details.feedingType === 'Formula' || ev.details.feedingType === 'ExpressedMilk') {
                    <div style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 0.3rem;">
                      Volume ingerido: <strong>{{ ev.details.formulaVolumeMl ?? 0 }} mL</strong>
                    </div>
                  } @else if (ev.notes) {
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.3rem;">
                      {{ ev.notes }}
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </details>
    </div>
  `
})
export class FeedingTrackerComponent {
  readonly store = inject(RoutineStore);

  readonly feedingEvents = computed<RoutineEventModel[]>(() =>
    this.store.events().filter(e => e.category === 'Feeding')
  );

  getFeedingIcon(ev: RoutineEventModel): string {
    switch (ev.details.feedingType) {
      case 'Breast':
        return '🤱';
      case 'Formula':
      case 'ExpressedMilk':
        return '🍼';
      case 'Solids':
        return '🍲';
      default:
        return '🍽️';
    }
  }

  getFeedingTitle(ev: RoutineEventModel): string {
    switch (ev.details.feedingType) {
      case 'Breast':
        return `Amamentação no Peito (${ev.durationMinutes ?? 1} min)`;
      case 'Formula':
        return `Fórmula Infantil (${ev.details.formulaVolumeMl ?? 0} mL)`;
      case 'ExpressedMilk':
        return `Leite (${ev.details.formulaVolumeMl ?? 0} mL)`;
      case 'Solids':
        return `Refeição Sólida • ${this.formatMealType(ev.details.solidsDetails?.mealType)}`;
      default:
        return 'Refeição / Nutrição';
    }
  }

  formatMealType(mealType?: string): string {
    switch (mealType) {
      case 'Breakfast':
        return 'Café da Manhã';
      case 'MorningSnack':
        return 'Lanche Matutino';
      case 'Lunch':
        return 'Almoço (4 Grupos)';
      case 'AfternoonSnack':
        return 'Lanche Vespertino';
      case 'Dinner':
        return 'Jantar (4 Grupos)';
      default:
        return mealType ?? 'Refeição';
    }
  }

  formatAcceptance(level?: string): string {
    switch (level) {
      case 'High':
        return 'Alta';
      case 'Medium':
        return 'Média';
      case 'Low':
        return 'Baixa';
      case 'Refused':
        return 'Recusa';
      default:
        return level ?? '-';
    }
  }

  formatAutonomy(autonomy?: string): string {
    switch (autonomy) {
      case 'BLW_Assisted':
        return 'BLW Assistido';
      case 'PureeSpoon':
        return 'Amassado / Colher';
      case 'FamilyTable':
        return 'Mesa da Família';
      default:
        return autonomy ?? '-';
    }
  }

  formatSec(sec: number): string {
    const m = Math.floor((sec || 0) / 60);
    const s = (sec || 0) % 60;
    return `${m}m ${s}s`;
  }
}
