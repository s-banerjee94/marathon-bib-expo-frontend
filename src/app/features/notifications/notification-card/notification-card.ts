import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import {
  AppNotification,
  NotificationEntityType,
  NotificationType,
} from '../../../core/models/notification.model';
import { NotificationService } from '../../../core/services/notification.service';

// type → PrimeIcon (no color classes per styling rules).
const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  IMPORT_COMPLETED: 'pi pi-file-import',
  IMPORT_FAILED: 'pi pi-exclamation-triangle',
  SHORT_URLS_COMPLETED: 'pi pi-link',
  EVENT_CREATED: 'pi pi-calendar-plus',
  EVENT_PUBLISHED: 'pi pi-megaphone',
  EVENT_CANCELLED: 'pi pi-calendar-times',
  EVENT_COMPLETED: 'pi pi-flag',
  CAMPAIGN_COMPLETED: 'pi pi-send',
  CAMPAIGN_FAILED: 'pi pi-exclamation-triangle',
};

// type → semantic colour primitive (the status palette, theme-reactive).
const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  IMPORT_COMPLETED: '--p-green-500',
  IMPORT_FAILED: '--p-red-500',
  SHORT_URLS_COMPLETED: '--p-blue-500',
  EVENT_CREATED: '--p-blue-500',
  EVENT_PUBLISHED: '--p-green-500',
  EVENT_CANCELLED: '--p-red-500',
  EVENT_COMPLETED: '--p-surface-500',
  CAMPAIGN_COMPLETED: '--p-green-500',
  CAMPAIGN_FAILED: '--p-red-500',
};

const ENTITY_LABELS: Record<NotificationEntityType, string> = {
  EVENT: 'Event',
  CAMPAIGN: 'Campaign',
};

@Component({
  selector: 'app-notification-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ButtonModule, CardModule, TagModule],
  templateUrl: './notification-card.html',
})
export class NotificationCard {
  readonly notification = input.required<AppNotification>();
  // Emitted after navigation so a host popover can close itself.
  readonly navigated = output<void>();
  // Emitted (with the notification id) when an unread card is marked read, so hosts
  // that keep their own list copy can sync it.
  readonly read = output<string>();

  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  readonly icon = computed(() => NOTIFICATION_ICONS[this.notification().type] ?? 'pi pi-bell');

  private readonly colorVar = computed(
    () => NOTIFICATION_COLORS[this.notification().type] ?? '--primary-color',
  );
  readonly iconColor = computed(() => `var(${this.colorVar()})`);
  readonly iconBg = computed(() => `color-mix(in srgb, var(${this.colorVar()}), transparent 88%)`);

  readonly entityLabel = computed(() => {
    const type = this.notification().entityType;
    return type ? ENTITY_LABELS[type] : null;
  });

  // EVENT routes by id; CAMPAIGN has no route reachable from the campaign id alone
  // (campaigns are nested under an event), so it stays unroutable until the payload
  // carries the parent eventId.
  private readonly route = computed<unknown[] | null>(() => {
    const notif = this.notification();
    if (!notif.entityType || !notif.entityId) return null;
    if (notif.entityType === 'EVENT') return ['/events', notif.entityId];
    return null;
  });
  readonly routable = computed(() => this.route() !== null);

  // Flatten the card into a compact list row: no border/shadow, transparent (read) or
  // faintly primary-tinted (unread) background, body padding within the ≤1 spacing rule.
  readonly cardPt = computed(() => ({
    root: {
      style: this.notification().read
        ? 'border: none; box-shadow: none; background: transparent'
        : 'border: none; box-shadow: none; background: color-mix(in srgb, var(--primary-color), transparent 94%)',
    },
    body: { class: '!p-1' },
  }));

  onCardClick(): void {
    this.markRead();
  }

  onGoTo(event: Event): void {
    event.stopPropagation();
    this.markRead();
    const route = this.route();
    if (route) this.router.navigate(route);
    this.navigated.emit();
  }

  private markRead(): void {
    const notif = this.notification();
    if (notif.read) return;
    this.notificationService.markAsRead(notif.id);
    this.read.emit(notif.id);
  }
}
