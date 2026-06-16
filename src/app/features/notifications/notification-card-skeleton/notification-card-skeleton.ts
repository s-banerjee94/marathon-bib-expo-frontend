import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-notification-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, SkeletonModule],
  templateUrl: './notification-card-skeleton.html',
})
export class NotificationCardSkeleton {
  // Match the notification card's flat, compact row.
  readonly cardPt = {
    root: { style: 'border: none; box-shadow: none; background: transparent' },
    body: { class: '!p-1' },
  };
}
