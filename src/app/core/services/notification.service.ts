import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppNotification, NotificationListResponse } from '../models/notification.model';
import { BASE_URI } from '../../shared/constants/api.constant';

const POLL_INTERVAL_MS = 25_000;
const PAGE_SIZE = 20;

/**
 * In-app notification bell, backed by short-polling (there is no push/SSE).
 * The badge count is polled cheaply on a timer; the full list is fetched only
 * when the count changes or the user opens the bell. State is strictly per-user
 * and is reset on connect()/disconnect() so a user switch never leaks data.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${BASE_URI}/notifications`;

  private readonly unreadCountSignal = signal<number>(0);
  private readonly notificationsSignal = signal<AppNotification[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly loadingSignal = signal(false);
  private readonly loadingMoreSignal = signal(false);
  private readonly hasMoreSignal = signal(false);

  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  readonly hasMore = this.hasMoreSignal.asReadonly();

  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  // Cursor for the next page; reset whenever we restart from page 1.
  private cursor: string | null = null;

  connect(): void {
    this.reset();
    this.pollUnreadCount();
    this.pollTimerId ??= setInterval(() => this.pollUnreadCount(), POLL_INTERVAL_MS);
  }

  disconnect(): void {
    if (this.pollTimerId !== null) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
    this.reset();
  }

  /** Called when the bell opens: always restart from page 1 (cursors are single-use). */
  openNotifications(): void {
    this.refreshList();
  }

  /** Fetch the next page and append it; on a stale/foreign cursor (400) restart from page 1. */
  loadMore(): void {
    if (!this.hasMoreSignal() || this.cursor === null || this.loadingMoreSignal()) return;

    this.loadingMoreSignal.set(true);
    this.http
      .get<NotificationListResponse>(this.apiUrl, {
        params: { limit: PAGE_SIZE, cursor: this.cursor },
      })
      .subscribe({
        next: (res) => {
          this.notificationsSignal.update((list) => [...list, ...(res.items ?? [])]);
          this.cursor = res.lastEvaluatedKey;
          this.hasMoreSignal.set(res.hasMore);
          this.loadingMoreSignal.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingMoreSignal.set(false);
          if (err.status === 400) this.refreshList();
        },
      });
  }

  /**
   * Raw paginated fetch for the full-page list, which manages its own cursor/state
   * independently of the bell's signals. Pass `null` for the first page.
   */
  fetchPage(cursor: string | null): Observable<NotificationListResponse> {
    const params: Record<string, string | number> = { limit: PAGE_SIZE };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<NotificationListResponse>(this.apiUrl, { params });
  }

  markAsRead(id: string): void {
    const target = this.notificationsSignal().find((n) => n.id === id);
    if (target?.read) return;

    // Optimistic: mark-as-read is idempotent server-side, so no need to pre-check.
    this.notificationsSignal.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    this.unreadCountSignal.update((count) => Math.max(0, count - 1));

    this.http.patch(`${this.apiUrl}/${encodeURIComponent(id)}/read`, {}).subscribe({
      next: () => this.pollUnreadCount(),
    });
  }

  markAllAsRead(): void {
    if (this.unreadCountSignal() === 0) return;

    this.notificationsSignal.update((list) => list.map((n) => (n.read ? n : { ...n, read: true })));
    this.unreadCountSignal.set(0);

    this.http.patch(`${this.apiUrl}/read-all`, {}).subscribe({
      next: () => this.pollUnreadCount(),
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private reset(): void {
    this.cursor = null;
    this.unreadCountSignal.set(0);
    this.notificationsSignal.set([]);
    this.hasMoreSignal.set(false);
    this.loadedSignal.set(false);
    this.loadingSignal.set(false);
    this.loadingMoreSignal.set(false);
  }

  private pollUnreadCount(): void {
    this.http.get<{ count: number }>(`${this.apiUrl}/unread-count`).subscribe({
      next: (res) => {
        const previous = this.unreadCountSignal();
        this.unreadCountSignal.set(res.count);
        // Only refresh the list if it has already been opened — otherwise wait for open.
        if (res.count !== previous && this.loadedSignal()) this.refreshList();
      },
    });
  }

  private refreshList(): void {
    this.cursor = null;
    this.loadingSignal.set(true);
    this.http
      .get<NotificationListResponse>(this.apiUrl, { params: { limit: PAGE_SIZE } })
      .subscribe({
        next: (res) => {
          this.notificationsSignal.set(res.items ?? []);
          this.cursor = res.lastEvaluatedKey;
          this.hasMoreSignal.set(res.hasMore);
          this.loadedSignal.set(true);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      });
  }
}
