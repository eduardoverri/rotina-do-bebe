import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoutineStore } from '../../../../core/state/routine.store';

@Component({
  selector: 'app-solids-plate-selector',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card" style="border-top: 4px solid var(--cat-feeding);">
      <h3 class="section-title">
        <span aria-hidden="true">🍲</span>
        <span>Prato Balanceado dos 4 Grupos & Rotina Familiar (6 a 24 Meses)</span>
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
        Seção 2.2 e 2.3: Garante densidade de ferro heme, zinco e calorias (sem sal excessivo e zero açúcar até 2 anos).
      </p>

      <div class="grid-3" style="margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Refeição</label>
          <select class="input-field" [(ngModel)]="mealType">
            <option value="Breakfast">Café da Manhã</option>
            <option value="MorningSnack">Lanche Matutino (Fruta)</option>
            <option value="Lunch">Almoço (Prato 4 Grupos)</option>
            <option value="AfternoonSnack">Lanche Vespertino</option>
            <option value="Dinner">Jantar (Prato 4 Grupos)</option>
          </select>
        </div>

        <div>
          <label style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Nível de Aceitação</label>
          <select class="input-field" [(ngModel)]="acceptanceLevel">
            <option value="High">Alta (Comeu com entusiasmo)</option>
            <option value="Medium">Média (Autorregulação moderada)</option>
            <option value="Low">Baixa (Oscilação fisiológica / Dentição)</option>
            <option value="Refused">Recusa (Não substituir por leite/ultraprocessados)</option>
          </select>
        </div>

        <div>
          <label style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Método / Autonomia</label>
          <select class="input-field" [(ngModel)]="eatingAutonomy">
            <option value="BLW_Assisted">Participativa / BLW Assistido</option>
            <option value="PureeSpoon">Amassado no garfo / Colher</option>
            <option value="FamilyTable">Mesa da Família (12–24m)</option>
          </select>
        </div>
      </div>

      <!-- Os 4 Quadrantes do Prato Balanceado -->
      <div class="grid-2" style="margin-bottom: 1rem;">
        <!-- Grupo 1: Frutas, Hortaliças e Verduras -->
        <div class="card-elevated">
          <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem;">🥦 1. Frutas, Hortaliças e Verduras</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            @for (item of vegOptions; track item) {
              <button
                type="button"
                class="btn"
                style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
                [class.btn-diaper]="selectedVeg().includes(item)"
                (click)="toggleItem(selectedVeg, vegOtherActive, item)">
                {{ item }}
              </button>
            }
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-diaper]="vegOtherActive()"
              (click)="toggleOther(selectedVeg, vegOtherActive)">
              Outros
            </button>
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-sleep]="selectedVeg().includes('Nenhum')"
              (click)="selectNone(selectedVeg, vegOtherActive, vegOtherText)">
              Nenhum
            </button>
          </div>
          @if (vegOtherActive()) {
            <input
              type="text"
              class="input-field"
              style="margin-top: 0.55rem;"
              [ngModel]="vegOtherText()"
              (ngModelChange)="vegOtherText.set($event)"
              placeholder="Descreva outros vegetais ou frutas..." />
          }
        </div>

        <!-- Grupo 2: Cereais e Tubérculos -->
        <div class="card-elevated">
          <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem;">🥔 2. Cereais e Tubérculos (Energéticos)</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            @for (item of cerealOptions; track item) {
              <button
                type="button"
                class="btn"
                style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
                [class.btn-milestone]="selectedCereals().includes(item)"
                (click)="toggleItem(selectedCereals, cerealOtherActive, item)">
                {{ item }}
              </button>
            }
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-milestone]="cerealOtherActive()"
              (click)="toggleOther(selectedCereals, cerealOtherActive)">
              Outros
            </button>
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-sleep]="selectedCereals().includes('Nenhum')"
              (click)="selectNone(selectedCereals, cerealOtherActive, cerealOtherText)">
              Nenhum
            </button>
          </div>
          @if (cerealOtherActive()) {
            <input
              type="text"
              class="input-field"
              style="margin-top: 0.55rem;"
              [ngModel]="cerealOtherText()"
              (ngModelChange)="cerealOtherText.set($event)"
              placeholder="Descreva outros cereais ou tubérculos..." />
          }
        </div>

        <!-- Grupo 3: Leguminosas -->
        <div class="card-elevated">
          <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem;">🫘 3. Leguminosas (Proteína Vegetal)</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            @for (item of legumeOptions; track item) {
              <button
                type="button"
                class="btn"
                style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
                [class.btn-feeding]="selectedLegumes().includes(item)"
                (click)="toggleItem(selectedLegumes, legumeOtherActive, item)">
                {{ item }}
              </button>
            }
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-feeding]="legumeOtherActive()"
              (click)="toggleOther(selectedLegumes, legumeOtherActive)">
              Outros
            </button>
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-sleep]="selectedLegumes().includes('Nenhum')"
              (click)="selectNone(selectedLegumes, legumeOtherActive, legumeOtherText)">
              Nenhum
            </button>
          </div>
          @if (legumeOtherActive()) {
            <input
              type="text"
              class="input-field"
              style="margin-top: 0.55rem;"
              [ngModel]="legumeOtherText()"
              (ngModelChange)="legumeOtherText.set($event)"
              placeholder="Descreva outras leguminosas..." />
          }
        </div>

        <!-- Grupo 4: Proteínas Animais (Ferro Heme) -->
        <div class="card-elevated">
          <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem;">🥩 4. Proteínas Animais (Ferro Heme)</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            @for (item of proteinOptions; track item) {
              <button
                type="button"
                class="btn"
                style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
                [class.btn-health]="selectedProteins().includes(item)"
                (click)="toggleItem(selectedProteins, proteinOtherActive, item)">
                {{ item }}
              </button>
            }
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-health]="proteinOtherActive()"
              (click)="toggleOther(selectedProteins, proteinOtherActive)">
              Outros
            </button>
            <button
              type="button"
              class="btn"
              style="padding: 0.35rem 0.65rem; min-height: 34px; font-size: 0.82rem;"
              [class.btn-sleep]="selectedProteins().includes('Nenhum')"
              (click)="selectNone(selectedProteins, proteinOtherActive, proteinOtherText)">
              Nenhum
            </button>
          </div>
          @if (proteinOtherActive()) {
            <input
              type="text"
              class="input-field"
              style="margin-top: 0.55rem;"
              [ngModel]="proteinOtherText()"
              (ngModelChange)="proteinOtherText.set($event)"
              placeholder="Descreva outras proteínas animais..." />
          }
        </div>
      </div>

      <button type="button" class="btn btn-feeding" style="width: 100%;" (click)="savePlate()">
        <span aria-hidden="true">🍽️</span>
        <span>Registrar Refeição Sólida (4 Grupos)</span>
      </button>
    </div>
  `
})
export class SolidsPlateSelectorComponent {
  readonly store = inject(RoutineStore);

  mealType = 'Lunch';
  acceptanceLevel = 'High';
  eatingAutonomy = 'BLW_Assisted';

  readonly vegOptions = ['Abóbora', 'Brócolis', 'Cenoura', 'Abobrinha', 'Espinafre', 'Chuchu'];
  readonly cerealOptions = ['Arroz integral', 'Batata-doce', 'Mandioca', 'Inhame', 'Aveia (Glúten)', 'Milho'];
  readonly legumeOptions = ['Feijão carioca', 'Lentilha', 'Grão-de-bico', 'Ervilha seca'];
  readonly proteinOptions = ['Carne bovina', 'Frango desfiado', 'Ovo bem cozido ⚠️', 'Peixe (Tilápia) ⚠️', 'Fígado bovino'];

  readonly selectedVeg = signal<string[]>([]);
  readonly selectedCereals = signal<string[]>([]);
  readonly selectedLegumes = signal<string[]>([]);
  readonly selectedProteins = signal<string[]>([]);

  readonly vegOtherActive = signal<boolean>(false);
  readonly vegOtherText = signal<string>('');
  readonly cerealOtherActive = signal<boolean>(false);
  readonly cerealOtherText = signal<string>('');
  readonly legumeOtherActive = signal<boolean>(false);
  readonly legumeOtherText = signal<string>('');
  readonly proteinOtherActive = signal<boolean>(false);
  readonly proteinOtherText = signal<string>('');

  toggleItem(
    targetSignal: ReturnType<typeof signal<string[]>>,
    _otherActiveSignal: ReturnType<typeof signal<boolean>>,
    item: string
  ): void {
    const current = targetSignal().filter(i => i !== 'Nenhum');
    if (current.includes(item)) {
      targetSignal.set(current.filter(i => i !== item));
    } else {
      targetSignal.set([...current, item]);
    }
  }

  toggleOther(
    targetSignal: ReturnType<typeof signal<string[]>>,
    otherActiveSignal: ReturnType<typeof signal<boolean>>
  ): void {
    const next = !otherActiveSignal();
    otherActiveSignal.set(next);
    if (next) {
      targetSignal.set(targetSignal().filter(i => i !== 'Nenhum'));
    }
  }

  selectNone(
    targetSignal: ReturnType<typeof signal<string[]>>,
    otherActiveSignal: ReturnType<typeof signal<boolean>>,
    otherTextSignal: ReturnType<typeof signal<string>>
  ): void {
    if (targetSignal().includes('Nenhum')) {
      targetSignal.set([]);
    } else {
      otherActiveSignal.set(false);
      otherTextSignal.set('');
      targetSignal.set(['Nenhum']);
    }
  }

  private buildGroupList(
    selected: string[],
    otherActive: boolean,
    otherText: string
  ): string[] {
    const list = [...selected];
    const custom = otherText.trim();
    if (otherActive && custom) {
      list.push(`Outros: ${custom}`);
    } else if (otherActive && !custom) {
      list.push('Outros');
    }
    return list;
  }

  async savePlate(): Promise<void> {
    const fruitsAndVegetables = this.buildGroupList(
      this.selectedVeg(),
      this.vegOtherActive(),
      this.vegOtherText()
    );
    const cerealsAndTubers = this.buildGroupList(
      this.selectedCereals(),
      this.cerealOtherActive(),
      this.cerealOtherText()
    );
    const legumes = this.buildGroupList(
      this.selectedLegumes(),
      this.legumeOtherActive(),
      this.legumeOtherText()
    );
    const animalProtein = this.buildGroupList(
      this.selectedProteins(),
      this.proteinOtherActive(),
      this.proteinOtherText()
    );

    const allergens: string[] = [];
    for (const p of animalProtein) {
      if (p.includes('Ovo')) allergens.push('Ovo Cozido');
      if (p.includes('Peixe')) allergens.push('Peixe');
    }
    for (const c of cerealsAndTubers) {
      if (c.includes('Glúten')) allergens.push('Glúten (Aveia)');
    }

    await this.store.logSolidsPlate({
      mealType: this.mealType,
      fruitsAndVegetables,
      cerealsAndTubers,
      legumes,
      animalProtein,
      acceptanceLevel: this.acceptanceLevel,
      eatingAutonomy: this.eatingAutonomy,
      allergensPresented: allergens
    });
  }
}
