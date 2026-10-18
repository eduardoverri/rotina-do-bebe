import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { BabyStore } from '../../core/state/baby.store';
import { RoutineStore } from '../../core/state/routine.store';
import { PopupAlertService } from '../../core/services/popup-alert.service';
import { BabyAgePipe } from '../../shared/pipes/baby-age.pipe';

@Component({
  selector: 'app-children-manager',
  standalone: true,
  imports: [FormsModule, DatePipe, BabyAgePipe],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <!-- 1. Formulário para Adicionar Novo Filho(a) à Conta Google (No início) -->
      <section class="card" style="border-top: 4px solid var(--cat-diaper);">
        <h3 class="section-title">
          <span aria-hidden="true">➕</span>
          <span>Adicionar Novo Filho(a) à Conta Google</span>
        </h3>
        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Cria um espaço isolado de rotina, vacinas e marcos motores (com cálculo automático de idade corrigida se prematuro &lt; 37 semanas).
        </p>

        <div class="grid-2" style="margin-bottom: 0.85rem;">
          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Nome do Filho(a)</label>
            <input type="text" class="input-field" [(ngModel)]="name" placeholder="Nome do filho(a)" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Data de Nascimento</label>
            <input type="date" class="input-field" [(ngModel)]="birthDateInput" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Semanas Gestacionais (IG)</label>
            <input type="number" class="input-field" [(ngModel)]="gestationalWeeks" min="24" max="42" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Dias Gestacionais (+dias)</label>
            <input type="number" class="input-field" [(ngModel)]="gestationalDays" min="0" max="6" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Peso Atual (Gramas)</label>
            <input type="number" class="input-field" [(ngModel)]="currentWeightGrams" min="500" max="20000" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Comprimento Atual (cm)</label>
            <input type="number" step="0.5" class="input-field" [(ngModel)]="currentHeightCm" min="30" max="110" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Perímetro Cefálico (cm)</label>
            <input type="number" step="0.1" class="input-field" [(ngModel)]="headCircumferenceCm" min="20" max="60" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Sexo Biológico (Curva OMS)</label>
            <select class="input-field" [(ngModel)]="gender">
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Tipo Sanguíneo</label>
            <select class="input-field" [(ngModel)]="bloodType">
              <option value="O+">O+</option>
              <option value="A+">A+</option>
              <option value="B+">B+</option>
              <option value="AB+">AB+</option>
              <option value="O-">O-</option>
              <option value="A-">A-</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-diaper"
          style="width: 100%;"
          (click)="createChild()">
          <span aria-hidden="true">👶</span>
          <span>Cadastrar Filho(a) e Iniciar Rotina Isolada</span>
        </button>
      </section>

      <!-- 2. Lista de Filhos vinculados à Conta Google atual (Recolhível ao final) -->
      <details class="card collapsible-card" style="border-top: 4px solid var(--cat-sleep);">
        <summary class="collapsible-summary">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1;">
            <span class="section-title" style="margin-bottom: 0;">
              <span aria-hidden="true">👶</span>
              <span>Filhos Vinculados à Conta Google</span>
            </span>
            <span class="badge badge-sleep">{{ babyStore.babies().length }} filho(s)</span>
          </div>
        </summary>

        <div class="collapsible-body">
          <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Usuário: <strong>{{ authService.currentUser()?.email }}</strong> • Cada filho possui linha do tempo, janelas de sono, alérgenos e marcos 100% separados.
          </p>

          @if (babyStore.babies().length === 0) {
            <div class="card-elevated" style="text-align: center; padding: 1.5rem;">
              <p style="font-weight: 700;">Nenhum filho cadastrado nesta Conta Google ainda.</p>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.3rem;">
                Utilize o formulário acima para adicionar o primeiro filho(a) à sua conta.
              </p>
            </div>
          }

          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            @for (b of babyStore.babies(); track b.id) {
              <div
                class="card-elevated"
                [style.border-width]="babyStore.selectedBabyId() === b.id ? '2px' : '1px'"
                [style.border-color]="babyStore.selectedBabyId() === b.id ? 'var(--cat-sleep)' : 'var(--border-subtle)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.1rem; font-weight: 800;">{{ b.name }}</span>
                      @if (babyStore.selectedBabyId() === b.id) {
                        <span class="badge badge-diaper">✓ Selecionado</span>
                      }
                    </div>
                    <div style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 0.2rem;">
                      Idade: <strong>{{ b | babyAge }}</strong> • Nasc.: {{ b.birthDate | date:'dd/MM/yyyy' }} ({{ b.gestationalWeeks }}s {{ b.gestationalDays }}d)
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.15rem;">
                      Peso atual: {{ b.currentWeightGrams }}g • Estatura: {{ b.currentHeightCm }}cm • Perímetro Cefálico: {{ b.headCircumferenceCm }}cm • Sangue: {{ b.bloodType }}
                    </div>
                  </div>

                  <div style="display: flex; gap: 0.45rem;">
                    <button
                      type="button"
                      class="btn btn-sleep"
                      style="min-height: 36px; font-size: 0.8rem;"
                      (click)="selectChild(b.id)">
                      <span>Abrir Rotina</span>
                    </button>

                    <button
                      type="button"
                      class="btn"
                      style="min-height: 36px; font-size: 0.8rem;"
                      (click)="removeChild(b.id)"
                      title="Remover cadastro deste filho">
                      <span aria-hidden="true">🗑️</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </details>
    </div>
  `
})
export class ChildrenManagerComponent {
  readonly authService = inject(AuthService);
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);
  private readonly popupAlert = inject(PopupAlertService);

  @Output() readonly childSelected = new EventEmitter<void>();

  name = '';
  birthDateInput = '';
  gestationalWeeks = 39;
  gestationalDays = 0;
  gender = 'F';
  currentWeightGrams = 3200;
  currentHeightCm = 49;
  headCircumferenceCm = 35;
  bloodType = 'O+';

  async selectChild(babyId: string): Promise<void> {
    this.babyStore.selectBaby(babyId);
    await this.routineStore.refreshAllForBaby(babyId, true);
    this.childSelected.emit();
  }

  async createChild(): Promise<void> {
    if (!this.name.trim()) {
      this.popupAlert.incompleteForm('Informe o nome do filho(a) para realizar o cadastro.');
      return;
    }
    if (!this.birthDateInput) {
      this.popupAlert.incompleteForm('Informe a data de nascimento do filho(a).');
      return;
    }
    if (
      !this.gestationalWeeks ||
      this.gestationalWeeks < 22 ||
      this.gestationalWeeks > 44 ||
      this.gestationalDays === null ||
      this.gestationalDays === undefined ||
      this.gestationalDays < 0 ||
      this.gestationalDays > 6
    ) {
      this.popupAlert.incompleteForm('Preencha as semanas e dias gestacionais com valores válidos.');
      return;
    }
    if (
      !this.currentWeightGrams ||
      this.currentWeightGrams <= 0 ||
      !this.currentHeightCm ||
      this.currentHeightCm <= 0 ||
      !this.headCircumferenceCm ||
      this.headCircumferenceCm <= 0
    ) {
      this.popupAlert.incompleteForm('Preencha o peso, o comprimento e o perímetro cefálico com valores válidos.');
      return;
    }

    const created = await this.routineStore.createChildForAuthenticatedUser({
      name: this.name.trim(),
      birthDate: new Date(this.birthDateInput).toISOString(),
      gestationalWeeks: this.gestationalWeeks,
      gestationalDays: this.gestationalDays,
      gender: this.gender,
      birthWeightGrams: this.currentWeightGrams,
      birthLengthCm: this.currentHeightCm,
      currentWeightGrams: this.currentWeightGrams,
      currentHeightCm: this.currentHeightCm,
      headCircumferenceCm: this.headCircumferenceCm,
      bloodType: this.bloodType
    });
    if (created) {
      this.name = '';
      this.birthDateInput = '';
      this.childSelected.emit();
    }
  }

  async removeChild(babyId: string): Promise<void> {
    await this.routineStore.deleteChildForAuthenticatedUser(babyId);
  }
}
