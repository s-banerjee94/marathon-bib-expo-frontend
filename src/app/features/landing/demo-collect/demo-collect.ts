import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { DemoRunner } from '../../../core/models/demo-session.model';
import { DemoSessionService } from '../demo-session.service';

type ViewState = 'loading' | 'ready' | 'success' | 'gone' | 'offline';

// Phone-side page of the landing hero's live QR demo (route /demo/:code, no
// auth, no app shell). Scanning the QR on the desktop bib lands here: a mini
// distributor view with the runner's details and one Mark Collected action.
@Component({
  selector: 'app-demo-collect',
  imports: [RouterLink, ButtonModule, CardModule, SkeletonModule, TagModule],
  templateUrl: './demo-collect.html',
  host: { class: 'block min-h-screen bg-[var(--surface-ground)]' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoCollect implements OnInit {
  // Bound from the route param via withComponentInputBinding().
  code = input.required<string>();

  private service = inject(DemoSessionService);

  readonly state = signal<ViewState>('loading');
  readonly runner = signal<DemoRunner | null>(null);
  readonly isCollecting = signal(false);
  // Backend error messages are written for direct display — rendered verbatim.
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');
    // The first GET flips the session to SCANNED, which drives the desktop's
    // "phone connected" hint; status tells us whether it was already collected
    // (e.g. the visitor refreshed the success screen).
    forkJoin({
      session: this.service.getSession(this.code()),
      status: this.service.getStatus(this.code()),
    }).subscribe({
      next: ({ session, status }) => {
        this.runner.set(session.runner);
        this.state.set(status.status === 'COLLECTED' ? 'success' : 'ready');
      },
      error: (error: HttpErrorResponse) => this.handleLoadError(error),
    });
  }

  collect(): void {
    if (this.isCollecting()) {
      return;
    }
    this.isCollecting.set(true);
    this.errorMessage.set('');
    this.service.collect(this.code()).subscribe({
      next: () => {
        this.isCollecting.set(false);
        this.state.set('success');
      },
      error: (error: HttpErrorResponse) => {
        this.isCollecting.set(false);
        this.handleCollectError(error);
      },
    });
  }

  private handleLoadError(error: HttpErrorResponse): void {
    if (error.status === 404 || error.status === 410) {
      // Expired (410) and evicted/unknown (404) get the same "fresh QR" UX.
      this.errorMessage.set(this.backendMessage(error));
      this.state.set('gone');
      return;
    }
    this.state.set('offline');
  }

  private handleCollectError(error: HttpErrorResponse): void {
    if (error.status === 409 || error.status === 404 || error.status === 410) {
      // 409: another phone collected first — the fresh QR is already on screen.
      this.errorMessage.set(this.backendMessage(error));
      this.state.set('gone');
      return;
    }
    // 429/5xx: the session may still be alive, so keep the button usable and
    // show the backend's display-ready message (e.g. rate limit) when there is one.
    this.errorMessage.set(
      this.backendMessage(
        error,
        'Could not reach the demo service. Check your connection and try again.',
      ),
    );
  }

  private backendMessage(
    error: HttpErrorResponse,
    fallback = 'This demo session is no longer active.',
  ): string {
    const message = (error.error as { message?: string } | null)?.message;
    return message || fallback;
  }
}
