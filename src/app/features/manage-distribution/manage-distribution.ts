import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { DistributionService } from '../../core/services/distribution.service';
import { UserRole } from '../../core/models/user.model';
import {
  ParticipantDistributionResponse,
  ParticipantPendingGoodies,
} from '../../core/models/distribution.model';
import { Participant } from '../../core/models/participant.model';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';
import { EventSelector } from '../../components/event-selector/event-selector';
import { BibLookupTab } from './components/bib-lookup-tab/bib-lookup-tab';
import { PendingBibsTab } from './components/pending-bibs-tab/pending-bibs-tab';
import { PendingGoodiesTab } from './components/pending-goodies-tab/pending-goodies-tab';
import { ActivityLogsTab } from './components/activity-logs-tab/activity-logs-tab';

/** Minimal shape shared by Participant and ParticipantDistributionResponse for dialog usage */
type DistributionTarget = Participant | ParticipantDistributionResponse;

@Component({
  selector: 'app-manage-distribution',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    TabsModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    OrganizationSelector,
    EventSelector,
    BibLookupTab,
    PendingBibsTab,
    PendingGoodiesTab,
    ActivityLogsTab,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './manage-distribution.html',
  styleUrl: './manage-distribution.css',
})
export class ManageDistribution implements OnInit {
  @ViewChild(EventSelector) eventSelector?: EventSelector;
  @ViewChild(BibLookupTab) bibLookupTab?: BibLookupTab;
  @ViewChild(PendingBibsTab) pendingBibsTab?: PendingBibsTab;
  @ViewChild(PendingGoodiesTab) pendingGoodiesTab?: PendingGoodiesTab;
  @ViewChild(ActivityLogsTab) activityLogsTab?: ActivityLogsTab;

  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);
  private distributionService = inject(DistributionService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  // Selection
  selectedOrganizationId = signal<number | undefined>(undefined);
  selectedEventId = signal<number | undefined>(undefined);
  isRestrictedUser = signal(false);
  activeTab = signal<string>('lookup');

  // Role permissions
  canUndoBib = computed(() =>
    this.authService.hasAnyRole([
      UserRole.ROOT,
      UserRole.ADMIN,
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ]),
  );
  canViewLogs = computed(() =>
    this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN]),
  );

  // Collect BIB dialog
  collectBibVisible = signal(false);
  collectBibTarget = signal<DistributionTarget | null>(null);
  collectBibLoading = signal(false);
  selectedGoodiesForCollect: string[] = [];
  collectBibForm: FormGroup = this.fb.group({ collectorName: [''], collectorPhone: [''] });

  // Distribute Goodies dialog
  distributeGoodiesVisible = signal(false);
  distributeGoodiesTarget = signal<DistributionTarget | ParticipantPendingGoodies | null>(null);
  distributeGoodiesLoading = signal(false);
  selectedGoodiesForDistribute: string[] = [];

  ngOnInit(): void {
    const restricted = this.authService.hasAnyRole([
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
      UserRole.DISTRIBUTOR,
    ]);
    this.isRestrictedUser.set(restricted);
    if (restricted) {
      const user = this.authService.currentUser();
      if (user?.organizationId) this.selectedOrganizationId.set(user.organizationId);
    }
  }

  onOrganizationChange(organizationId: number | undefined): void {
    this.selectedOrganizationId.set(organizationId);
    this.eventSelector?.reset();
    this.selectedEventId.set(undefined);
  }

  onEventChange(eventId: number | undefined): void {
    this.selectedEventId.set(eventId);
    if (eventId) this.activeTab.set('lookup');
  }

  onTabChange(value: string | number | undefined): void {
    if (value == null) return;
    this.activeTab.set(String(value));
  }

  // Collect BIB dialog
  openCollectBibDialog(participant: DistributionTarget): void {
    this.collectBibTarget.set(participant);
    this.collectBibForm.reset({ collectorName: '', collectorPhone: '' });
    this.selectedGoodiesForCollect = [];
    this.collectBibVisible.set(true);
  }

  toggleGoodiesForCollect(item: string): void {
    const idx = this.selectedGoodiesForCollect.indexOf(item);
    this.selectedGoodiesForCollect =
      idx === -1
        ? [...this.selectedGoodiesForCollect, item]
        : this.selectedGoodiesForCollect.filter((i) => i !== item);
  }

  isGoodiesSelectedForCollect(item: string): boolean {
    return this.selectedGoodiesForCollect.includes(item);
  }

  submitCollectBib(): void {
    const eventId = this.selectedEventId();
    const participant = this.collectBibTarget();
    if (!eventId || !participant) return;

    const { collectorName, collectorPhone } = this.collectBibForm.value as {
      collectorName: string;
      collectorPhone: string;
    };

    this.collectBibLoading.set(true);
    this.distributionService
      .collectBib(eventId, participant.bibNumber, {
        collectorName: collectorName?.trim() || undefined,
        collectorPhone: collectorPhone?.trim() || undefined,
        goodiesItems:
          this.selectedGoodiesForCollect.length > 0 ? this.selectedGoodiesForCollect : undefined,
      })
      .subscribe({
        next: () => {
          this.collectBibLoading.set(false);
          this.collectBibVisible.set(false);
          this.bibLookupTab?.reload();
          this.pendingBibsTab?.reload();
        },
        error: (error) => {
          this.collectBibLoading.set(false);
          this.errorHandler.showError(error, 'Failed to collect BIB');
        },
      });
  }

  // Distribute Goodies dialog
  openDistributeGoodiesDialog(participant: DistributionTarget | ParticipantPendingGoodies): void {
    this.distributeGoodiesTarget.set(participant);
    const pending =
      'pendingItems' in participant
        ? (participant as ParticipantPendingGoodies).pendingItems
        : this.getPendingGoodiesItems(participant as DistributionTarget);
    this.selectedGoodiesForDistribute = [...pending];
    this.distributeGoodiesVisible.set(true);
  }

  toggleGoodiesForDistribute(item: string): void {
    const idx = this.selectedGoodiesForDistribute.indexOf(item);
    this.selectedGoodiesForDistribute =
      idx === -1
        ? [...this.selectedGoodiesForDistribute, item]
        : this.selectedGoodiesForDistribute.filter((i) => i !== item);
  }

  isGoodiesSelectedForDistribute(item: string): boolean {
    return this.selectedGoodiesForDistribute.includes(item);
  }

  submitDistributeGoodies(): void {
    const eventId = this.selectedEventId();
    const participant = this.distributeGoodiesTarget();
    if (!eventId || !participant || this.selectedGoodiesForDistribute.length === 0) return;

    this.distributeGoodiesLoading.set(true);
    this.distributionService
      .distributeGoodies(eventId, participant.bibNumber, {
        goodiesItems: this.selectedGoodiesForDistribute,
      })
      .subscribe({
        next: () => {
          this.distributeGoodiesLoading.set(false);
          this.distributeGoodiesVisible.set(false);
          this.bibLookupTab?.reload();
          this.pendingGoodiesTab?.reload();
        },
        error: (error) => {
          this.distributeGoodiesLoading.set(false);
          this.errorHandler.showError(error, 'Failed to distribute goodies');
        },
      });
  }

  // Undo BIB
  confirmUndoBib(participant: DistributionTarget): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to undo BIB collection for <strong>${participant.fullName}</strong> (BIB: ${participant.bibNumber})?`,
      header: 'Undo BIB Collection',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Yes, Undo', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        const eventId = this.selectedEventId();
        if (!eventId) return;
        this.distributionService.undoBib(eventId, participant.bibNumber).subscribe({
          next: () => this.bibLookupTab?.reload(),
          error: (error) => this.errorHandler.showError(error, 'Failed to undo BIB collection'),
        });
      },
    });
  }

  // Dialog helpers
  getAllGoodiesKeys(participant: DistributionTarget | ParticipantPendingGoodies): string[] {
    return participant.goodies ? Object.keys(participant.goodies) : [];
  }

  getPendingGoodiesItems(participant: DistributionTarget): string[] {
    if (!participant.goodies) return [];
    return Object.keys(participant.goodies).filter(
      (item) => !participant.goodiesDistribution?.[item],
    );
  }

  getPendingItemsForDialog(): string[] {
    const target = this.distributeGoodiesTarget();
    if (!target) return [];
    return 'pendingItems' in target
      ? (target as ParticipantPendingGoodies).pendingItems
      : this.getPendingGoodiesItems(target as DistributionTarget);
  }
}
