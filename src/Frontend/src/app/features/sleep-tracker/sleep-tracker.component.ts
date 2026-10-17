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
    <app-wake-window-widget />
    <div class="grid-2" style="margin-top: 1rem;">
      <app-nap-stopwatch />
      <app-transition-readiness-chart />
    </div>
  `
})
export class SleepTrackerComponent {}
