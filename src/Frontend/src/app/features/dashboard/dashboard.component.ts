import { Component } from '@angular/core';
import { WakeWindowWidgetComponent } from '../../shared/components/wake-window-widget/wake-window-widget.component';
import { DailySummaryCardsComponent } from './components/daily-summary-cards/daily-summary-cards.component';
import { TimelineFeedComponent } from './components/timeline-feed/timeline-feed.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    WakeWindowWidgetComponent,
    DailySummaryCardsComponent,
    TimelineFeedComponent
  ],
  template: `
    <app-wake-window-widget />
    <app-daily-summary-cards />
    <app-timeline-feed />
  `
})
export class DashboardComponent {}
