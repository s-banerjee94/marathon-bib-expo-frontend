import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { firstValueFrom } from 'rxjs';
import { toDataURL } from 'qrcode';
import {
  DemoRunner,
  DemoSessionResponse,
  DemoSessionStatusResponse,
} from '../../core/models/demo-session.model';
import { CardFly } from './card-fly';
import { DemoSessionService } from './demo-session.service';
import { LetterPop } from './letter-pop';
import { Magnetic } from './magnetic';

gsap.registerPlugin(ScrollTrigger);

/** Race-band theme — real expo bibs are color-coded per race. */
interface BibTheme {
  race: string;
  band: string;
  bandInk: string;
}

interface LiveMint {
  session: DemoSessionResponse;
  qr: string;
}

const SCAN_DURATION_MS = 700;
const COLLECTED_HOLD_MS = 750;
/** Fallback short-poll cadence, used only when the SSE stream is unavailable. */
const POLL_INTERVAL_MS = 1000;
/** If the stream hasn't opened by then (per-origin connection limit — another
 * tab holds the SSE slot), demote this page to polling until it's reloaded. */
const SSE_CONNECT_TIMEOUT_MS = 5000;
/** The demo is auxiliary: after a failed connect, retry ONCE this much later. */
const RETRY_DELAY_MS = 60_000;
/** After this many consecutive failures, stop trying until the page is reloaded.
 * Failures are always silent — the offline tap-to-scan bib is the whole fallback UX. */
const MAX_CONSECUTIVE_MINT_FAILURES = 2;
/** Re-mint this long before expiry so a visitor never scans a QR that dies mid-scan.
 * Ceiling — capped to 20% of the session's actual TTL so short (test) TTLs still cycle. */
const EXPIRY_SAFETY_MS = 15_000;
/** Floor between proactive re-mints — keeps a near-zero TTL from looping into the
 * create rate limit. Ceiling — capped to 50% of the session's actual TTL, min 5s. */
const MIN_SESSION_AGE_MS = 60_000;
const MIN_SESSION_AGE_FLOOR_MS = 5_000;

@Component({
  selector: 'app-hero',
  imports: [RouterLink, ButtonModule, DecimalPipe, UpperCasePipe, Magnetic, LetterPop, CardFly],
  templateUrl: './hero.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly demoService = inject(DemoSessionService);

  private readonly section = viewChild.required<ElementRef<HTMLElement>>('heroSection');
  private readonly bg = viewChild.required<ElementRef<HTMLElement>>('heroBg');
  private readonly demoCol = viewChild.required<ElementRef<HTMLElement>>('demoCol');
  private readonly meltWrap = viewChild.required<ElementRef<HTMLElement>>('meltWrap');
  private readonly bibText = viewChild.required<ElementRef<SVGTextElement>>('bibText');
  private readonly cardFly = viewChild.required(CardFly);
  private mm?: gsap.MatchMedia;

  /** Non-breaking space keeps the gap between words inside inline-block letter spans. */
  readonly meltChars: readonly string[] = Array.from('melt\u00A0down');

  private readonly themes: readonly BibTheme[] = [
    { race: 'FULL MARATHON', band: '#16a34a', bandInk: '#ffffff' },
    { race: 'HALF MARATHON', band: '#f59e0b', bandInk: '#0f172a' },
    { race: '10K', band: '#2563eb', bandInk: '#ffffff' },
  ];

  private readonly fallbackRunners: readonly DemoRunner[] = [
    { name: 'Asha Verma', bib: '12044', category: 'M 30–34' },
    { name: 'Rohan Iyer', bib: '08871', category: 'F 18–24' },
    { name: 'Meera Pillai', bib: '15532', category: 'M 45–49' },
    { name: 'Kabir Anand', bib: '03210', category: 'F 30–34' },
    { name: 'Divya Nair', bib: '21987', category: 'M 18–24' },
  ];

  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly runnerIndex = signal(0);
  private scanTimeoutId?: ReturnType<typeof setTimeout>;

  readonly isScanning = signal(false);
  readonly isCollected = signal(false);
  readonly busy = signal(false);
  readonly collectedCount = signal(1284);

  // Live QR demo state — all of it optional: with no session the hero renders
  // the offline tap-to-scan bib exactly as before.
  readonly liveSession = signal<DemoSessionResponse | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  readonly phoneConnected = signal(false);
  readonly liveRunner = computed(() => this.liveSession()?.runner ?? null);

  readonly current = computed(() => this.liveRunner() ?? this.fallbackRunners[this.runnerIndex()]);
  readonly theme = computed(() => this.themes[this.runnerIndex() % this.themes.length]);

  private pollTimerId?: ReturnType<typeof setTimeout>;
  private retryTimerId?: ReturnType<typeof setTimeout>;
  private expiryTimerId?: ReturnType<typeof setTimeout>;
  private sseConnectTimerId?: ReturnType<typeof setTimeout>;
  private eventSource?: EventSource;
  /** Sticky until reload: set when the stream can't be established (e.g. the
   * browser's per-origin connection limit — only one tab gets an SSE slot). */
  private sseUnavailable = false;
  private intersectionObserver?: IntersectionObserver;
  private heroInView = false;
  private tabVisible = typeof document !== 'undefined' ? !document.hidden : true;
  private minting = false;
  private mintCooldownUntil = 0;
  private mintFailCount = 0;
  /** Two consecutive failed connects turn the live demo off until reload. */
  private demoDisabled = false;
  /** The demo is auxiliary — never mint before the page has fully loaded. */
  private pageLoaded = typeof document !== 'undefined' && document.readyState === 'complete';
  private sessionMintedAt = 0;
  private sessionExpiresAt = 0;
  // Margins derived per session from the backend's expiresInSeconds (see
  // adoptSession), so the loop adapts to whatever TTL the backend is configured with.
  private expirySafetyMs = EXPIRY_SAFETY_MS;
  private minSessionAgeMs = MIN_SESSION_AGE_MS;

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.scanTimeoutId);
      clearTimeout(this.retryTimerId);
      clearTimeout(this.expiryTimerId);
      this.stopWatching();
      this.intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.mm?.revert();
    });

    afterNextRender(() => {
      this.setupLiveDemo();
      this.zone.runOutsideAngular(() => {
        this.mm = gsap.matchMedia();
        this.mm.add('(prefers-reduced-motion: no-preference)', () => {
          const scrub: ScrollTrigger.Vars = {
            trigger: this.section().nativeElement,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          };
          gsap.to(this.bg().nativeElement, { yPercent: 18, ease: 'none', scrollTrigger: scrub });
          gsap.to(this.demoCol().nativeElement, { y: -60, ease: 'none', scrollTrigger: scrub });

          const wrap = this.meltWrap().nativeElement;
          const chars = Array.from(wrap.querySelectorAll<HTMLElement>('[data-melt-char]'));
          const line = wrap.querySelector<HTMLElement>('[data-melt-line]');
          let unmeltTimerId: ReturnType<typeof setTimeout> | undefined;
          const melt = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') {
              clearTimeout(unmeltTimerId);
              unmeltTimerId = setTimeout(unmelt, 1200);
            }
            gsap.to(chars, {
              y: () => gsap.utils.random(12, 26),
              rotation: () => gsap.utils.random(-12, 12),
              scaleY: () => gsap.utils.random(1.15, 1.4),
              transformOrigin: 'top center',
              duration: 0.5,
              ease: 'power2.in',
              stagger: { each: 0.03, from: 'random' },
              overwrite: true,
            });
            if (line) {
              gsap.to(line, {
                y: 7,
                rotation: -2.5,
                duration: 0.5,
                ease: 'power2.in',
                overwrite: true,
              });
            }
          };
          const unmelt = (): void => {
            gsap.to(chars, {
              y: 0,
              rotation: 0,
              scaleY: 1,
              duration: 1,
              ease: 'elastic.out(1, 0.4)',
              stagger: 0.02,
              overwrite: true,
            });
            if (line) {
              gsap.to(line, {
                y: 0,
                rotation: 0,
                duration: 0.8,
                ease: 'elastic.out(1, 0.5)',
                overwrite: true,
              });
            }
          };
          // A tap fires pointerleave right after pointerup, which would undo the
          // melt instantly — on touch the timer above springs it back instead.
          const onLeave = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') {
              return;
            }
            unmelt();
          };
          wrap.addEventListener('pointerenter', melt);
          wrap.addEventListener('pointerleave', onLeave);
          return () => {
            clearTimeout(unmeltTimerId);
            wrap.removeEventListener('pointerenter', melt);
            wrap.removeEventListener('pointerleave', onLeave);
          };
        });
      });
    });
  }

  scan(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.stopWatching();
    // In live mode the abandoned session just expires server-side and a fresh one
    // backs the next card; in fallback mode stay offline — the loop retries later.
    const nextMint = this.liveSession() ? this.mintNext() : Promise.resolve(null);
    this.runCollectSequence(nextMint);
  }

  // ── Live QR demo lifecycle ────────────────────────────────────────────────

  private setupLiveDemo(): void {
    this.zone.runOutsideAngular(() => {
      if (!this.pageLoaded) {
        window.addEventListener('load', this.onPageLoad, { once: true });
        this.destroyRef.onDestroy(() => window.removeEventListener('load', this.onPageLoad));
      }
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          this.heroInView = entries[0]?.isIntersecting ?? false;
          this.evaluateLoop();
        },
        { threshold: 0.25 },
      );
      this.intersectionObserver.observe(this.demoCol().nativeElement);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    });
  }

  private readonly onPageLoad = (): void => {
    this.pageLoaded = true;
    this.evaluateLoop();
  };

  private readonly onVisibilityChange = (): void => {
    this.tabVisible = !document.hidden;
    if (
      this.tabVisible &&
      this.sseUnavailable &&
      this.liveSession() &&
      this.heroInView &&
      !this.busy()
    ) {
      // Polling can't replay what happened while hidden — reconcile right away.
      // (The stream needs no equivalent: it re-sends the state on reconnect.)
      this.stopPolling();
      this.pollStatus();
      return;
    }
    this.evaluateLoop();
  };

  /** Central gate: sessions are minted and watched only while the QR can be seen. */
  private evaluateLoop(): void {
    if (!this.heroInView || !this.tabVisible || this.busy()) {
      this.stopWatching();
      return;
    }
    if (!this.liveSession()) {
      if (this.pageLoaded && !this.demoDisabled) {
        void this.mintInPlace();
      }
      return;
    }
    this.startWatching();
  }

  /** Watch the current session: SSE stream first, short-poll once demoted. */
  private startWatching(): void {
    if (this.sessionNearExpiry()) {
      void this.mintInPlace();
      return;
    }
    if (this.sseUnavailable) {
      this.startPolling();
      return;
    }
    this.openStream();
  }

  private stopWatching(): void {
    this.closeStream();
    this.stopPolling();
  }

  private sessionNearExpiry(): boolean {
    const now = Date.now();
    // The age floor keeps a misconfigured/too-short TTL from re-minting in a
    // tight loop straight into the create rate limit.
    return (
      now >= this.sessionExpiresAt - this.expirySafetyMs &&
      now - this.sessionMintedAt >= this.minSessionAgeMs
    );
  }

  /**
   * Creates a session + QR, or resolves null after any failure (backend down,
   * 429, offline). Failure is silent by design — the landing page must never
   * depend on the backend — and starts a cooldown before the next attempt.
   */
  private async mintNext(): Promise<LiveMint | null> {
    if (this.demoDisabled || this.minting || Date.now() < this.mintCooldownUntil) {
      return null;
    }
    this.minting = true;
    try {
      const session = await firstValueFrom(this.demoService.createSession());
      const qr = await this.buildQr(session.code);
      return { session, qr };
    } catch {
      this.registerMintFailure();
      return null;
    } finally {
      this.minting = false;
    }
  }

  /** Any failed connect (backend down, 429, offline — no distinction) counts here.
   * One silent retry after RETRY_DELAY_MS; the second consecutive failure turns the
   * demo off for good. A reload starts the budget fresh; a success resets it. */
  private registerMintFailure(): void {
    this.mintFailCount += 1;
    if (this.mintFailCount >= MAX_CONSECUTIVE_MINT_FAILURES) {
      this.demoDisabled = true;
      clearTimeout(this.retryTimerId);
      return;
    }
    this.mintCooldownUntil = Date.now() + RETRY_DELAY_MS;
    this.scheduleRetry();
  }

  /** Mint outside the collect animation: initial session, expiry, dead code. */
  private async mintInPlace(): Promise<void> {
    if (this.demoDisabled || this.minting) {
      return;
    }
    if (Date.now() < this.mintCooldownUntil) {
      // Can't replace a dead session yet — stop advertising its QR meanwhile.
      if (this.liveSession()) {
        this.zone.run(() => this.enterFallback());
      }
      this.scheduleRetry();
      return;
    }
    const next = await this.mintNext();
    this.zone.run(() => {
      if (this.busy()) {
        return; // A manual scan started mid-mint; its own mint governs the next card.
      }
      if (next) {
        this.adoptSession(next);
      } else {
        this.enterFallback();
      }
    });
    if (next) {
      this.evaluateLoop();
    }
  }

  private adoptSession(next: LiveMint): void {
    this.stopWatching();
    this.liveSession.set(next.session);
    this.qrDataUrl.set(next.qr);
    this.phoneConnected.set(false);
    this.sessionMintedAt = Date.now();
    // Duration-based contract: anchoring the server-computed TTL on receipt makes
    // client-clock skew irrelevant — both sides of every comparison share one clock.
    const ttl = Math.max(0, next.session.expiresInSeconds * 1000);
    this.sessionExpiresAt = this.sessionMintedAt + ttl;
    // A working session proves the endpoint is reachable — the failure budget resets.
    this.mintFailCount = 0;
    this.mintCooldownUntil = 0;
    this.expirySafetyMs = Math.min(EXPIRY_SAFETY_MS, ttl * 0.2);
    this.minSessionAgeMs = Math.max(
      MIN_SESSION_AGE_FLOOR_MS,
      Math.min(MIN_SESSION_AGE_MS, ttl * 0.5),
    );
    this.armExpiryTimer();
  }

  private enterFallback(): void {
    this.stopWatching();
    clearTimeout(this.expiryTimerId);
    this.liveSession.set(null);
    this.qrDataUrl.set(null);
    this.phoneConnected.set(false);
  }

  /** Proactively replace the QR shortly before expiry — a visitor must never
   * scan a code that dies mid-scan. Fires only while the QR is watchable;
   * hidden/off-screen pages reconcile through startWatching() on return. */
  private armExpiryTimer(): void {
    this.zone.runOutsideAngular(() => {
      clearTimeout(this.expiryTimerId);
      const wait = Math.max(
        this.sessionExpiresAt - this.expirySafetyMs - Date.now(),
        this.minSessionAgeMs,
      );
      this.expiryTimerId = setTimeout(() => {
        if (this.heroInView && this.tabVisible && !this.busy() && this.liveSession()) {
          void this.mintInPlace();
        }
      }, wait);
    });
  }

  private scheduleRetry(): void {
    if (this.demoDisabled) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      clearTimeout(this.retryTimerId);
      this.retryTimerId = setTimeout(() => this.evaluateLoop(), RETRY_DELAY_MS + 1000);
    });
  }

  // ── SSE stream (primary status channel) ───────────────────────────────────

  private openStream(): void {
    if (this.eventSource) {
      return;
    }
    const session = this.liveSession();
    if (!session) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      const source = new EventSource(this.demoService.streamUrl(session.code));
      this.eventSource = source;
      this.sseConnectTimerId = setTimeout(() => {
        if (source.readyState !== EventSource.OPEN) {
          this.demoteToPolling(source);
        }
      }, SSE_CONNECT_TIMEOUT_MS);
      source.addEventListener('open', () => clearTimeout(this.sseConnectTimerId));
      source.addEventListener('status', (event) => {
        this.onStreamStatus(event as MessageEvent<string>);
      });
      source.addEventListener('error', () => {
        // CONNECTING means the browser is auto-reconnecting — always safe, the
        // server re-sends the current state on connect. CLOSED is final.
        if (source.readyState === EventSource.CLOSED) {
          this.demoteToPolling(source);
        }
      });
    });
  }

  private onStreamStatus(event: MessageEvent<string>): void {
    let status: DemoSessionStatusResponse['status'];
    try {
      status = (JSON.parse(event.data) as DemoSessionStatusResponse).status;
    } catch {
      return;
    }
    if (status === 'COLLECTED') {
      // The server hangs up after this event — close first so the browser
      // doesn't auto-reconnect just to hear COLLECTED again.
      this.onRemoteCollected();
      return;
    }
    if (status === 'SCANNED' && !this.phoneConnected()) {
      this.zone.run(() => this.phoneConnected.set(true));
    }
  }

  private demoteToPolling(source: EventSource): void {
    source.close();
    clearTimeout(this.sseConnectTimerId);
    if (this.eventSource === source) {
      this.eventSource = undefined;
    }
    this.sseUnavailable = true;
    this.evaluateLoop();
  }

  private closeStream(): void {
    clearTimeout(this.sseConnectTimerId);
    this.eventSource?.close();
    this.eventSource = undefined;
  }

  // ── Short-poll fallback ───────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimerId !== undefined) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.pollTimerId = setTimeout(() => {
        this.pollTimerId = undefined;
        this.pollStatus();
      }, POLL_INTERVAL_MS);
    });
  }

  private stopPolling(): void {
    clearTimeout(this.pollTimerId);
    this.pollTimerId = undefined;
  }

  private pollStatus(): void {
    const session = this.liveSession();
    if (!session || !this.heroInView || !this.tabVisible || this.busy()) {
      return;
    }
    if (this.sessionNearExpiry()) {
      void this.mintInPlace();
      return;
    }
    this.demoService.getStatus(session.code).subscribe({
      next: (res) => {
        if (res.status === 'COLLECTED') {
          this.onRemoteCollected();
          return;
        }
        if (res.status === 'SCANNED' && !this.phoneConnected()) {
          this.zone.run(() => this.phoneConnected.set(true));
        }
        this.startPolling();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404 || error.status === 410) {
          void this.mintInPlace();
          return;
        }
        // Lost the demo service mid-session — same silent budget as a failed create.
        this.zone.run(() => this.enterFallback());
        this.registerMintFailure();
      },
    });
  }

  /** The visitor tapped Mark Collected on their phone. */
  private onRemoteCollected(): void {
    this.stopWatching();
    const nextMint = this.mintNext();
    this.zone.run(() => {
      this.busy.set(true);
      this.phoneConnected.set(false);
      this.runCollectSequence(nextMint);
    });
  }

  private runCollectSequence(nextMint: Promise<LiveMint | null>): void {
    if (this.prefersReducedMotion) {
      this.markCollected();
      this.scanTimeoutId = setTimeout(() => {
        void this.finishSwap(nextMint);
      }, COLLECTED_HOLD_MS);
      return;
    }
    this.isScanning.set(true);
    this.scanTimeoutId = setTimeout(() => {
      this.isScanning.set(false);
      this.markCollected();
      this.scanTimeoutId = setTimeout(() => {
        void this.finishSwap(nextMint);
      }, COLLECTED_HOLD_MS);
    }, SCAN_DURATION_MS);
  }

  private async finishSwap(nextMint: Promise<LiveMint | null>): Promise<void> {
    const next = await nextMint;
    await this.cardFly().swap(() => this.applyNext(next));
    this.busy.set(false);
    this.evaluateLoop();
  }

  private applyNext(next: LiveMint | null): void {
    this.runnerIndex.update((i) => (i + 1) % this.fallbackRunners.length);
    this.isCollected.set(false);
    if (next) {
      this.adoptSession(next);
    } else {
      this.enterFallback();
    }
    if (!this.prefersReducedMotion) {
      this.scrambleBib();
    }
  }

  private buildQr(code: string): Promise<string> {
    // Fixed light modules keep the code scannable in dark mode; origin-based URL
    // works unchanged on LAN dev (phone hits the dev proxy) and in production.
    return toDataURL(`${window.location.origin}/demo/${code}`, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  }

  // ── Shared collect visuals ────────────────────────────────────────────────

  private markCollected(): void {
    this.isCollected.set(true);
    this.collectedCount.update((c) => c + 1);
  }

  /** Slot-machine roll while the new card drops in: digits lock left to right. */
  private scrambleBib(): void {
    const el = this.bibText().nativeElement;
    const target = this.current().bib;
    this.zone.runOutsideAngular(() => {
      const proxy = { p: 0 };
      gsap.to(proxy, {
        p: 1,
        duration: 0.8,
        delay: 0.15,
        ease: 'power1.out',
        overwrite: true,
        onUpdate: () => {
          const locked = Math.floor(proxy.p * target.length);
          let text = target.slice(0, locked);
          for (let i = locked; i < target.length; i++) {
            text += String(gsap.utils.random(0, 9, 1));
          }
          el.textContent = text;
        },
        onComplete: () => {
          el.textContent = target;
        },
      });
    });
  }
}
