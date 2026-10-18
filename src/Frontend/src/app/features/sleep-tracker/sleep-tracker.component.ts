import { Component } from '@angular/core';
import { WakeWindowWidgetComponent } from '../../shared/components/wake-window-widget/wake-window-widget.component';
import { NapStopwatchComponent } from './components/nap-stopwatch/nap-stopwatch.component';
import { TransitionReadinessChartComponent } from './components/transition-readiness-chart/transition-readiness-chart.component';

@Component({
  selector: 'app-sleep-tracker',
  standalone: true,
  imports: [
    WakeWindowWidgetComponent,
    NapStopwatchComponent,
    TransitionReadinessChartComponent
  ],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <!-- Formulário no início -->
      <app-nap-stopwatch />

      <!-- Caixas informativas e tabelas recolhíveis ao final -->
      <app-wake-window-widget />
      <app-transition-readiness-chart />
    </div>
  `
})
export class SleepTrackerComponent {}
