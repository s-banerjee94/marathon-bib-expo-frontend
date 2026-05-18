import { inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Subscription } from 'rxjs';
import { AppNotification, NotificationPageResponse } from '../models/notification.model';
import { AuthService } from './auth.service';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${BASE_URI}/notifications`;

  private readonly unreadCountSignal = signal<number>(0);
  private readonly notificationsSignal = signal<AppNotification[]>([]);
  private readonly loadedSignal = signal(false);
  private abortController: AbortController | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private tokenRefreshSubscription: Subscription | null = null;
  private connected = false;

  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();

  connect(): void {
    this.connected = true;
    this.loadUnreadCount();
    this.loadNotifications();
    this.openSseStream();

    // Refresh kills the prior SSE on the server — reopen with the new token.
    this.tokenRefreshSubscription ??= this.authService.tokenRefreshed$.subscribe(() => {
      if (this.connected) {
        this.loadNotifications();
        this.openSseStream();
      }
    });
  }

  disconnect(): void {
    this.connected = false;
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    this.tokenRefreshSubscription?.unsubscribe();
    this.tokenRefreshSubscription = null;
  }

  markAsRead(id: number): void {
    this.http.patch(`${this.apiUrl}/${id}/read`, {}).subscribe({
      next: () => {
        this.notificationsSignal.update((list) =>
          list.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
        this.unreadCountSignal.update((count) => Math.max(0, count - 1));
      },
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private loadUnreadCount(): void {
    this.http.get<{ count: number }>(`${this.apiUrl}/unread-count`).subscribe({
      next: (res) => this.unreadCountSignal.set(res.count),
    });
  }

  private loadNotifications(): void {
    this.http
      .get<NotificationPageResponse>(this.apiUrl, { params: { page: '0', size: '20' } })
      .subscribe({
        next: (res) => {
          this.notificationsSignal.set(res.content ?? []);
          this.loadedSignal.set(true);
        },
      });
  }

  private openSseStream(): void {
    this.abortController?.abort();
    const token = this.authService.getToken();
    if (!token) return;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    fetchEventSource(`${this.apiUrl}/stream`, {
      signal,
      openWhenHidden: true,
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      onmessage: (ev) => {
        if ((ev.event !== 'import:completed' && ev.event !== 'import:failed') || !ev.data) return;
        try {
          this.handleIncomingNotification(JSON.parse(ev.data) as AppNotification);
        } catch {
          // ignore malformed frames
        }
      },
      onerror: (err) => {
        if (signal.aborted) throw err; // intentional disconnect — stop retrying
        console.error('[NotificationService] SSE error:', err);
        this.loadNotifications(); // fetch any missed notifications
        // Do not throw — let fetchEventSource retry automatically with back-off
      },
      onclose: () => {
        if (!signal.aborted) {
          this.loadNotifications(); // catch any missed notifications
          this.scheduleReconnect();
        }
      },
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId !== null) return;
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (this.connected) {
        this.openSseStream();
      }
    }, 5000);
  }

  private handleIncomingNotification(notification: AppNotification): void {
    this.ngZone.run(() => {
      this.notificationsSignal.update((list) => [notification, ...list]);
      if (!notification.read) {
        this.unreadCountSignal.update((count) => count + 1);
      }
    });
  }
}
