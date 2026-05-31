import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { EventDetailsState } from '../event-details-state.service';

@Component({
  selector: 'app-goodies-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './goodies-section.html',
  styleUrl: './goodies-section.css',
  imports: [CardModule, TagModule, SkeletonModule, TooltipModule],
})
export class GoodiesSection {
  private readonly state = inject(EventDetailsState);

  protected readonly event = this.state.event;
  protected readonly goodiesArray = this.state.goodiesArray;
}
