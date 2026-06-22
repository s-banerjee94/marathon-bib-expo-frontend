import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule, ButtonSeverity } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { PopoverModule } from 'primeng/popover';
import { Participant } from '../../../core/models/participant.model';
import { ParticipantService } from '../../../core/services/participant.service';
import { DistributionService } from '../../../core/services/distribution.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user.model';
import { ParticipantDistributionCard } from '../manage-distribution/participant-distribution-card/participant-distribution-card';
import { DistributionDialogState } from '../manage-distribution/distribution-dialog-state.service';
import { ManageDistribution } from '../manage-distribution/manage-distribution';
import { EmptyIllustration } from '../../../shared/illustrations/empty-illustration';
import {
  BUTTON_SIZE,
  FORM_INPUT_SIZE,
  PAGINATION_LIMIT,
} from '../../../shared/constants/form.constants';

interface BarcodeDetectorResult {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>;
}
interface BarcodeDetectorStatic {
  new (options: { formats: string[] }): BarcodeDetectorLike;
}

@Component({
  selector: 'app-qr-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    CardModule,
    IconFieldModule,
    InputIconModule,
    FloatLabelModule,
    TagModule,
    SkeletonModule,
    MessageModule,
    PopoverModule,
    ParticipantDistributionCard,
    EmptyIllustration,
  ],
  templateUrl: './qr-scan.html',
})
export class QrScan implements OnDestroy {
  @ViewChild('videoEl') videoRef?: ElementRef<HTMLVideoElement>;

  private participantService = inject(ParticipantService);
  private distributionService = inject(DistributionService);
  private errorHandler = inject(ErrorHandlerService);
  private authService = inject(AuthService);
  private dialogState = inject(DistributionDialogState);
  parent = inject(ManageDistribution);

  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  buttonSize = BUTTON_SIZE;
  inputSize = FORM_INPUT_SIZE;
  skeletonRows = Array(2).fill({});

  barcodeDetectorSupported = 'BarcodeDetector' in window;

  // Scanner state
  isScanning = signal(false);
  isScanLoading = signal(false);
  scanError = signal<string | null>(null);
  private stream: MediaStream | null = null;
  private scanActive = false;

  // Search / results
  searchValue = signal('');
  results = signal<Participant[]>([]);
  loading = signal(false);
  isSearched = signal(false);
  hasMore = signal(false);
  lastEvaluatedKey = signal<string | undefined>(undefined);

  isInitialLoading = computed(() => this.loading() && this.results().length === 0);
  isLoadingMore = computed(() => this.loading() && this.results().length > 0);

  canUndoBib = computed(() =>
    this.authService.hasAnyRole([
      UserRole.ROOT,
      UserRole.ADMIN,
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ]),
  );

  constructor() {
    effect(
      () => {
        const id = this.eventId();
        untracked(() => {
          this.stopScan();
          this.clearResults();
          void id;
        });
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        if (this.dialogState.reloadTrigger() > 0) {
          untracked(() => this.reloadLookup());
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnDestroy(): void {
    this.stopScan();
  }

  async startScan(): Promise<void> {
    // The camera + BarcodeDetector APIs are only exposed in a secure context
    // (HTTPS or localhost). Over plain http://<ip> the browser hides them, so check
    // this FIRST — otherwise an Android Chrome user wrongly sees "browser unsupported".
    if (!window.isSecureContext) {
      this.scanError.set(
        'Camera scanning needs a secure (HTTPS) connection. Open this app over HTTPS to scan, or enter a BIB number manually below.',
      );
      return;
    }
    if (!this.barcodeDetectorSupported) {
      this.scanError.set(
        'QR scanning requires Chrome on Android or Safari 17.4+. Enter a BIB number manually below.',
      );
      return;
    }
    this.scanError.set(null);
    this.clearResults();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      this.isScanning.set(true);
      // Defer video attachment so Angular renders the video element first
      setTimeout(() => {
        const video = this.videoRef?.nativeElement;
        if (!video || !this.stream) return;
        video.srcObject = this.stream;
        video.play().then(() => this.runDetectionLoop());
      }, 100);
    } catch {
      this.scanError.set('Camera access denied. Please allow camera permission and try again.');
    }
  }

  stopScan(): void {
    this.scanActive = false;
    this.isScanning.set(false);
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  performSearch(): void {
    const bib = this.searchValue().trim();
    if (!bib || bib.length < 2) return;
    this.doLookup(bib);
  }

  clearResults(): void {
    this.results.set([]);
    this.isSearched.set(false);
    this.hasMore.set(false);
    this.lastEvaluatedKey.set(undefined);
    this.searchValue.set('');
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading()) return;
    const bib = this.searchValue().trim();
    if (!bib) return;

    this.loading.set(true);
    this.participantService
      .lookupParticipants({
        eventId: this.eventId(),
        searchType: 'BIB',
        searchValue: bib,
        limit: PAGINATION_LIMIT,
        lastEvaluatedKey: this.lastEvaluatedKey(),
      })
      .subscribe({
        next: (response) => {
          this.results.update((prev) => [...prev, ...response.participants]);
          this.hasMore.set(response.hasMore);
          this.lastEvaluatedKey.set(response.lastEvaluatedKey);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorHandler.showError(err, 'Load more failed');
        },
      });
  }

  private reloadLookup(): void {
    const bib = this.searchValue().trim();
    if (!this.isSearched() || !bib) return;
    this.results.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.doLookup(bib);
  }

  private runDetectionLoop(): void {
    this.scanActive = true;
    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector: BarcodeDetectorStatic })
      .BarcodeDetector;
    const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
    const video = this.videoRef!.nativeElement;

    const loop = async () => {
      if (!this.scanActive) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0 && this.scanActive) {
          this.stopScan();
          this.handleScanResult(barcodes[0].rawValue);
          return;
        }
      } catch {
        // detection failed for this frame, continue
      }
      if (this.scanActive) requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  private handleScanResult(code: string): void {
    this.isScanLoading.set(true);
    this.distributionService.scanQr(this.eventId(), { code }).subscribe({
      next: (response) => {
        const bib = response.bibNumber;
        this.searchValue.set(bib);
        this.isScanLoading.set(false);
        this.doLookup(bib);
      },
      error: (err) => {
        this.isScanLoading.set(false);
        this.errorHandler.showError(err, 'QR scan failed');
      },
    });
  }

  private doLookup(bibNumber: string): void {
    this.results.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.isSearched.set(true);
    this.loading.set(true);

    this.participantService
      .lookupParticipants({
        eventId: this.eventId(),
        searchType: 'BIB',
        searchValue: bibNumber,
        limit: PAGINATION_LIMIT,
      })
      .subscribe({
        next: (response) => {
          this.results.set(response.participants);
          this.hasMore.set(response.hasMore);
          this.lastEvaluatedKey.set(response.lastEvaluatedKey);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorHandler.showError(err, 'Lookup failed');
        },
      });
  }

  // --- BIB helpers (same as BibLookupTab) ---

  getBibStatus(participant: Participant): boolean {
    return !!participant.bibCollectedAt;
  }

  hasPendingGoodies(participant: Participant): boolean {
    if (!participant.goodies) return false;
    const keys = Object.keys(participant.goodies);
    return keys.length > 0 && keys.some((k) => !participant.goodiesDistribution?.[k]);
  }

  getGoodiesCount(goodies: { [key: string]: string } | undefined): number {
    return goodies ? Object.keys(goodies).length : 0;
  }

  getDistributedCount(participant: Participant): number {
    return participant.goodiesDistribution
      ? Object.keys(participant.goodiesDistribution).length
      : 0;
  }

  getGoodiesDistributionSeverity(participant: Participant): ButtonSeverity {
    const total = this.getGoodiesCount(participant.goodies);
    const distributed = this.getDistributedCount(participant);
    if (distributed === 0) return 'warn';
    if (distributed >= total) return 'success';
    return 'info';
  }

  getGoodiesDistributionEntries(
    participant: Participant,
  ): Array<{ key: string; value: string; distributed: boolean }> {
    const goodies = participant.goodies;
    if (!goodies) return [];
    return Object.keys(goodies).map((key) => ({
      key,
      value: goodies[key],
      distributed: !!participant.goodiesDistribution?.[key],
    }));
  }

  formatGoodiesKey(key: string): string {
    return key
      .split(/[-_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
