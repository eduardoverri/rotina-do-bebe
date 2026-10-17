import { Component } from '@angular/core';
import { BreastTimerComponent } from './components/breast-timer/breast-timer.component';
import { SolidsPlateSelectorComponent } from './components/solids-plate-selector/solids-plate-selector.component';
import { AllergenMonitorComponent } from './components/allergen-monitor/allergen-monitor.component';
import { HungerCuesGuideComponent } from './components/hunger-cues-guide/hunger-cues-guide.component';

@Component({
  selector: 'app-feeding-tracker',
  standalone: true,
  imports: [
    BreastTimerComponent,
    SolidsPlateSelectorComponent,
    AllergenMonitorComponent,
    HungerCuesGuideComponent
  ],
  template: `
    <div class="grid-2" style="margin-bottom: 1rem;">
      <app-breast-timer />
      <app-solids-plate-selector />
    </div>
    <div style="margin-bottom: 1rem;">
      <app-allergen-monitor />
    </div>
    <app-hunger-cues-guide />
  `
})
export class FeedingTrackerComponent {}
