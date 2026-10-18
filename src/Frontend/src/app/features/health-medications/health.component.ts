import { Component } from '@angular/core';
import { DoseCalculatorComponent } from './components/dose-calculator/dose-calculator.component';
import { IntervalCountdownComponent } from './components/interval-countdown/interval-countdown.component';
import { VaccineCardComponent } from './components/vaccine-card/vaccine-card.component';

@Component({
  selector: 'app-health-medications',
  standalone: true,
  imports: [
    DoseCalculatorComponent,
    IntervalCountdownComponent,
    VaccineCardComponent
  ],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <!-- Formulário no início -->
      <app-dose-calculator />

      <!-- Listas recolhíveis ao final -->
      <app-interval-countdown />
      <app-vaccine-card />
    </div>
  `
})
export class HealthComponent {}
