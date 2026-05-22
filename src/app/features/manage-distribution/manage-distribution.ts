import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  ParamMap,
  Params,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
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
import { DistributionDialogState } from './distribution-dialog-state.service';

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
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    OrganizationSelector,
    EventSelector,
  ],
  providers: [ConfirmationService, DistributionDialogState],
  templateUrl: './manage-distribution.html',
  styleUrl: './manage-distribution.css',
})
export class ManageDistribution implements OnInit {
  @ViewChild(EventSelector) eventSelector?: EventSelector;

  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);
  private distributionService = inject(DistributionService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private dialogState = inject(DistributionDialogState);

  // Selection
  selectedOrganizationId = signal<number | undefined>(undefined);
  selectedEventId = signal<number | undefined>(undefined);
  isRestrictedUser = signal(false);

  // Active tab derived from router state — reads from deepest child route
  activeTab = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.getDeepestChildPath() ?? 'lookup'),
    ),
    { initialValue: this.route.snapshot.firstChild?.firstChild?.routeConfig?.path ?? 'lookup' },
  );

  private getDeepestChildPath(): string | undefined {
    let snapshot = this.route.snapshot.firstChild;
    while (snapshot?.firstChild) {
      snapshot = snapshot.firstChild;
    }
    return snapshot?.routeConfig?.path;
  }

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

    // URL is the source of truth: organizationId comes from queryParam,
    // eventId comes from either queryParam or the child path :eventId.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyUrlToState(params));

    // Also react to navigation so eventId-in-path stays in sync with state.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.applyUrlToState(this.route.snapshot.queryParamMap));

    // If a restricted user landed without URL filters, seed the URL with their org so links stay shareable.
    if (restricted && !this.route.snapshot.queryParamMap.get('organizationId')) {
      const orgId = this.authService.currentUser()?.organizationId;
      if (orgId) {
        this.pushStateToUrl({ organizationId: String(orgId) });
      }
    }
  }

  private applyUrlToState(params: ParamMap): void {
    const orgIdParam = params.get('organizationId');
    const eventIdQueryParam = params.get('eventId');
    const eventIdPathParam = this.route.snapshot.firstChild?.paramMap.get('eventId');

    const orgId =
      orgIdParam && Number.isFinite(Number(orgIdParam)) ? Number(orgIdParam) : undefined;
    // Path eventId wins over queryParam — it's what the router-outlet's tab is rendering
    const eventIdSource = eventIdPathParam ?? eventIdQueryParam;
    const eventId =
      eventIdSource && Number.isFinite(Number(eventIdSource)) ? Number(eventIdSource) : undefined;

    const prevOrgId = this.selectedOrganizationId();

    this.selectedOrganizationId.set(orgId);
    this.selectedEventId.set(eventId);

    if (orgId !== prevOrgId) {
      this.eventSelector?.reset();
    }
  }

  private pushStateToUrl(updates: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: updates,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onOrganizationChange(organizationId: number | undefined): void {
    // Navigate back to base /distribution path (off the event sub-route) and reset event selection
    this.router.navigate(['/distribution'], {
      queryParams: {
        organizationId: organizationId != null ? String(organizationId) : null,
        eventId: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onEventChange(eventId: number | undefined): void {
    if (eventId != null) {
      // Navigate to the lookup tab for the new event, preserving queryParams (and updating eventId)
      this.router.navigate(['/distribution/event', eventId, 'lookup'], {
        queryParams: { eventId: String(eventId) },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } else {
      // Cleared event: go back to /distribution with no eventId
      this.router.navigate(['/distribution'], {
        queryParams: { eventId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
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
          this.dialogState.triggerReload();
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
          this.dialogState.triggerReload();
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
          next: () => this.dialogState.triggerReload(),
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
