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
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ButtonModule, ButtonSeverity } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';
import { CardModule } from 'primeng/card';
import { PopoverModule } from 'primeng/popover';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { Participant, LookupSearchType } from '../../../../core/models/participant.model';
import { Race, Category } from '../../../../core/models/event.model';
import { ParticipantService } from '../../../../core/services/participant.service';
import { DistributionService } from '../../../../core/services/distribution.service';
import { EventService } from '../../../../core/services/event.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/user.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { LOOKUP_SEARCH_TYPES } from '../../../../shared/constants/participant-columns.constant';
import {
  BUTTON_SIZE,
  FORM_INPUT_SIZE,
  PAGINATION_LIMIT,
} from '../../../../shared/constants/form.constants';
import { DistributionDialogState } from '../distribution-dialog-state.service';
import { ManageDistribution } from '../manage-distribution';
import { injectIsMobile } from '../../../../shared/utils/responsive.utils';
import { ParticipantDistributionCard } from '../participant-distribution-card/participant-distribution-card';
import { EmptyIllustration } from '../../../../shared/illustrations/empty-illustration';

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
  selector: 'app-bib-lookup-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    SkeletonModule,
    TableModule,
    SelectModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    FloatLabelModule,
    CardModule,
    PopoverModule,
    MessageModule,
    DialogModule,
    DefaultValuePipe,
    ParticipantDistributionCard,
    EmptyIllustration,
  ],
  templateUrl: './bib-lookup-tab.html',
})
export class BibLookupTab implements OnDestroy {
  @ViewChild('videoEl') videoRef?: ElementRef<HTMLVideoElement>;

  private participantService = inject(ParticipantService);
  private distributionService = inject(DistributionService);
  private eventService = inject(EventService);
  private errorHandler = inject(ErrorHandlerService);
  private authService = inject(AuthService);
  private dialogState = inject(DistributionDialogState);
  parent = inject(ManageDistribution);

  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  canUndoBib = computed(() =>
    this.authService.hasAnyRole([
      UserRole.ROOT,
      UserRole.ADMIN,
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ]),
  );

  buttonSize = BUTTON_SIZE;
  inputSize = FORM_INPUT_SIZE;
  isMobile = injectIsMobile();

  lookupSearchTypes = LOOKUP_SEARCH_TYPES;
  selectedSearchType = signal<LookupSearchType>('BIB');
  searchValue = signal<string>('');
  dropdownSelectedItem = signal<string>('');

  races = signal<Race[]>([]);
  categories = signal<Category[]>([]);
  isRacesLoading = signal(false);

  isDropdownSearch = computed(
    () => this.selectedSearchType() === 'RACE' || this.selectedSearchType() === 'CATEGORY',
  );

  // Lookup by race/category sends IDS, not names: RACE → raceId,
  // CATEGORY → `raceId#categoryId` (HttpParams URL-encodes the `#` as %23).
  // The label still shows the human-readable name.
  raceOptions = computed(() =>
    this.races().map((r) => ({ label: r.raceName, value: String(r.id) })),
  );
  categoryOptions = computed(() =>
    this.categories().map((c) => ({ label: c.categoryName, value: `${c.raceId}#${c.id}` })),
  );

  results = signal<Participant[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  lastEvaluatedKey = signal<string | undefined>(undefined);
  isSearched = signal(false);

  skeletonRows = Array(5).fill({});

  isInitialLoading = computed(() => this.loading() && this.results().length === 0);
  isLoadingMore = computed(() => this.loading() && this.results().length > 0);

  searchPlaceholder = computed(() => {
    const option = this.lookupSearchTypes.find((t) => t.value === this.selectedSearchType());
    return option?.placeholder || 'Enter search value';
  });

  // --- QR Scanner ---
  barcodeDetectorSupported = 'BarcodeDetector' in window;
  scanDialogVisible = signal(false);
  isScanning = signal(false);
  isScanLoading = signal(false);
  scanError = signal<string | null>(null);
  private stream: MediaStream | null = null;
  private scanActive = false;

  constructor() {
    effect(
      () => {
        const id = this.eventId();
        untracked(() => {
          this.resetState();
          if (id) {
            this.loadEventData(id);
          } else {
            this.races.set([]);
            this.categories.set([]);
          }
        });
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        if (this.dialogState.reloadTrigger() > 0) {
          untracked(() => this.reload());
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  onSearchTypeChange(): void {
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
  }

  performSearch(): void {
    const isDropdown = this.isDropdownSearch();
    const value = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();
    // The 2-char minimum only applies to free-text searches; a race/category id
    // (e.g. "5") selected from the dropdown is always a valid lookup value.
    if (!value || (!isDropdown && value.length < 2) || !this.eventId()) return;

    this.results.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.error.set(null);
    this.isSearched.set(true);
    this.doSearch();
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading()) return;
    this.doSearch();
  }

  reload(): void {
    if (!this.isSearched() || !this.eventId()) return;
    const currentResults = this.results();
    this.results.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.error.set(null);
    this.doSearch(
      currentResults.length > PAGINATION_LIMIT ? PAGINATION_LIMIT * 2 : PAGINATION_LIMIT,
    );
  }

  clearSearch(): void {
    this.resetState();
  }

  // --- QR Scanner ---

  openScanDialog(): void {
    if (!this.barcodeDetectorSupported) {
      this.scanError.set(
        'QR scanning requires Chrome on Android or Safari 17.4+. Please type the BIB number manually.',
      );
      this.scanDialogVisible.set(true);
      return;
    }
    this.scanError.set(null);
    this.scanDialogVisible.set(true);
    this.startCamera();
  }

  closeScanDialog(): void {
    this.stopCamera();
    this.scanDialogVisible.set(false);
    this.scanError.set(null);
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      this.isScanning.set(true);
      // Defer video attachment until dialog renders the video element
      setTimeout(() => {
        const video = this.videoRef?.nativeElement;
        if (!video || !this.stream) return;
        video.srcObject = this.stream;
        video.play().then(() => this.runDetectionLoop());
      }, 150);
    } catch {
      this.scanError.set('Camera access denied. Please allow camera permission and try again.');
      this.isScanning.set(false);
    }
  }

  private stopCamera(): void {
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
          this.stopCamera();
          this.onQrDetected(barcodes[0].rawValue);
          return;
        }
      } catch {
        // frame detection failed, continue
      }
      if (this.scanActive) requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  private onQrDetected(code: string): void {
    this.isScanLoading.set(true);
    this.distributionService.scanQr(this.eventId(), { code }).subscribe({
      next: (response) => {
        const bib = response.bibNumber;
        this.isScanLoading.set(false);
        this.scanDialogVisible.set(false);
        // Populate BIB search and trigger the lookup
        this.selectedSearchType.set('BIB');
        this.searchValue.set(bib);
        this.results.set([]);
        this.lastEvaluatedKey.set(undefined);
        this.error.set(null);
        this.isSearched.set(true);
        this.doSearch();
      },
      error: (err) => {
        this.isScanLoading.set(false);
        this.scanError.set('QR code is invalid or does not belong to this event.');
        this.errorHandler.showError(err, 'QR scan failed');
        // Restart camera for another attempt
        this.startCamera();
      },
    });
  }

  // --- Existing private helpers ---

  private doSearch(limit = PAGINATION_LIMIT): void {
    const eventId = this.eventId();
    if (!eventId) return;

    const isDropdown = this.isDropdownSearch();
    const searchValue = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();

    this.loading.set(true);
    this.participantService
      .lookupParticipants({
        eventId,
        searchType: this.selectedSearchType(),
        searchValue,
        limit,
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
          this.errorHandler.showError(err, 'Search failed');
          this.error.set('Search failed. Please try again.');
        },
      });
  }

  private resetState(): void {
    this.results.set([]);
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.selectedSearchType.set('BIB');
    this.lastEvaluatedKey.set(undefined);
    this.hasMore.set(false);
    this.error.set(null);
    this.isSearched.set(false);
  }

  private loadEventData(eventId: number): void {
    this.isRacesLoading.set(true);
    this.eventService.getRaces(eventId).subscribe({
      next: (races) => {
        this.races.set(races);
        this.isRacesLoading.set(false);
        if (races.length > 0) {
          const catObs = races.map((r) => this.eventService.getCategoriesByRace(eventId, r.id));
          forkJoin(catObs).subscribe({
            next: (results) => this.categories.set(results.flat()),
            error: () => {},
          });
        }
      },
      error: () => {
        this.isRacesLoading.set(false);
      },
    });
  }

  getBibStatus(participant: Participant): boolean {
    return !!participant.bibCollectedAt;
  }

  hasPendingGoodies(participant: Participant): boolean {
    if (!participant.goodies) return false;
    const keys = Object.keys(participant.goodies);
    if (keys.length === 0) return false;
    return keys.some((k) => !participant.goodiesDistribution?.[k]);
  }

  getGoodiesCount(goodies: { [key: string]: string } | undefined): number {
    if (!goodies) return 0;
    return Object.keys(goodies).length;
  }

  getDistributedCount(participant: Participant): number {
    const dist = participant.goodiesDistribution;
    if (!dist) return 0;
    return Object.keys(dist).length;
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
