import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AppNotification } from '../../../core/models/notification.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { NotificationCard } from '../notification-card/notification-card';
import { NotificationCardSkeleton } from '../notification-card-skeleton/notification-card-skeleton';
import { EmptyIllustration } from '../../../shared/illustrations/empty-illustration';

interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, NotificationCard, NotificationCardSkeleton, EmptyIllustration],
  templateUrl: './notifications-page.html',
})
export class NotificationsPage implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly location = inject(Location);

  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly loaded = signal(false);
  readonly hasMore = signal(false);
  readonly unreadCount = this.notificationService.unreadCount;

  // Notifications are a timeline — bucket them by day so the feed reads as activity,
  // not a flat dump. Items arrive newest-first, so buckets fall in order naturally.
  readonly groups = computed<NotificationGroup[]>(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;

    const labelFor = (iso: string): string => {
      const t = new Date(iso).getTime();
      if (t >= todayMs) return 'Today';
      if (t >= yesterdayMs) return 'Yesterday';
      return 'Earlier';
    };

    const groups: NotificationGroup[] = [];
    for (const n of this.items()) {
      const label = labelFor(n.createdAt);
      let group = groups.find((g) => g.label === label);
      if (!group) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(n);
    }
    return groups;
  });

  // This page walks the cursor independently of the bell popover.
  private cursor: string | null = null;

  ngOnInit(): void {
    this.loadFirstPage();
  }

  loadMore(): void {
    if (!this.hasMore() || this.cursor === null || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.notificationService.fetchPage(this.cursor).subscribe({
      next: (res) => {
        this.items.update((list) => [...list, ...(res.items ?? [])]);
        this.cursor = res.lastEvaluatedKey;
        this.hasMore.set(res.hasMore);
        this.loadingMore.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingMore.set(false);
        // Stale/foreign cursor → restart from page 1.
        if (err.status === 400) this.loadFirstPage();
        else this.errorHandler.showError(err);
      },
    });
  }

  onMarkAllRead(): void {
    this.notificationService.markAllAsRead();
    this.items.update((list) => list.map((n) => (n.read ? n : { ...n, read: true })));
  }

  onCardRead(id: string): void {
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  goBack(): void {
    this.location.back();
  }

  private loadFirstPage(): void {
    this.cursor = null;
    this.loading.set(true);
    this.notificationService.fetchPage(null).subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.cursor = res.lastEvaluatedKey;
        this.hasMore.set(res.hasMore);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loaded.set(true);
        this.errorHandler.showError(err);
      },
    });
  }
}
