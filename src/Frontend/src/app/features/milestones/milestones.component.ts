import { Component } from '@angular/core';
import { MilestoneTimelineTreeComponent } from './components/milestone-timeline-tree/milestone-timeline-tree.component';

@Component({
  selector: 'app-milestones',
  standalone: true,
  imports: [MilestoneTimelineTreeComponent],
  template: `
    <app-milestone-timeline-tree />
  `
})
export class MilestonesComponent {}
