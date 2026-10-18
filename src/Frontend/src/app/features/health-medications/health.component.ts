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
    <div class="grid-2">
      <app-dose-calculator />
      <app-interval-countdown />
    </div>
    <app-vaccine-card />
  `
})
export class HealthComponent {}
