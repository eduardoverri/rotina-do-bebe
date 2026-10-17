import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-stool-visual-picker',
  standalone: true,
  template: `
    <div class="card-elevated" style="margin-bottom: 1rem;">
      <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.5rem;">
        3. COLORAÇÃO DAS FEZES & TRIAGEM DE SINAIS DE ALERTA PEDIÁTRICO
      </div>
      <div class="grid-3" style="margin-bottom: 1rem;">
        @for (c of colors; track c.value) {
          <button
            type="button"
            class="btn"
            [class.btn-health]="c.isAlert && selectedColor === c.value"
            [class.btn-diaper]="!c.isAlert && selectedColor === c.value"
            (click)="selectColor.emit(c.value)">
            <span aria-hidden="true">{{ c.icon }}</span>
            <span>{{ c.label }}</span>
          </button>
        }
      </div>

      <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.5rem;">
        4. CONSISTÊNCIA
      </div>
      <div class="grid-3">
        @for (cons of consistencies; track cons.value) {
          <button
            type="button"
            class="btn"
            [class.btn-diaper]="selectedConsistency === cons.value"
            (click)="selectConsistency.emit(cons.value)">
            <span>{{ cons.label }}</span>
          </button>
        }
      </div>
    </div>
  `
})
export class StoolVisualPickerComponent {
  @Input() selectedColor = 'Mustard';
  @Input() selectedConsistency = 'LiquidPastous';
  @Output() readonly selectColor = new EventEmitter<string>();
  @Output() readonly selectConsistency = new EventEmitter<string>();

  readonly colors = [
    { value: 'Mustard', label: 'Mostarda / Amarelada (Normal)', icon: '🟡', isAlert: false },
    { value: 'BrownishGreen', label: 'Amarronzada / Esverdeada (Normal)', icon: '🟢', isAlert: false },
    { value: 'WhiteGrey', label: 'Branca / Acinzentada (Acolia ⚠️)', icon: '⚪', isAlert: true },
    { value: 'Black', label: 'Preta / Melena (Alerta ⚠️)', icon: '⚫', isAlert: true },
    { value: 'RedBlood', label: 'Sangue Vivo / APLV (Alerta ⚠️)', icon: '🔴', isAlert: true }
  ];

  readonly consistencies = [
    { value: 'LiquidPastous', label: 'Líquida / Pastosa (Aleitamento)' },
    { value: 'MoldedPastous', label: 'Moldada / Pastosa Firme (Sólidos)' },
    { value: 'Hardened', label: 'Ressecada / Endurecida (Constipação ⚠️)' }
  ];
}
