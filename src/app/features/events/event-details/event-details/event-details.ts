import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { Menu } from 'primeng/menu';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { Event, EventStatus } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
import { ImageUploadService } from '../../../../core/services/image-upload.service';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import {
  activeChildRouteSignal,
  firstChildPath,
} from '../../../../shared/utils/active-route.utils';
import { EventListBus } from '../../event-list-bus.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/user.model';
import { DistributionService } from '../../../../core/services/distribution.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EventDetailsState } from '../event-details-state.service';
import { FormatEventDateTimePipe } from '../../../../shared/pipes/format-event-date-time-pipe';
import {
  getEventStatusLabel,
  getEventStatusSeverity,
} from '../../../../shared/utils/event-status.utils';
import { EventForm } from '../../event-form/event-form';
import { BUTTON_SIZE } from '../../../../shared/constants/form.constants';
import { injectIsMobile } from '../../../../shared/utils/responsive.utils';
import { MobileTabBar, TabItem } from '../../../../shared/components/mobile-tab-bar/mobile-tab-bar';

const DEFAULT_TAB = 'dashboard';

@Component({
  selector: 'app-event-details',
  imports: [
    CommonModule,
    TabsModule,
    CardModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    Menu,
    ConfirmPopupModule,
    TooltipModule,
    DialogModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormatEventDateTimePipe,
    MobileTabBar,
    ImageUpload,
  ],
  providers: [DialogService, ConfirmationService, EventDetailsState],
  templateUrl: './event-details.html',
  styleUrl: './event-details.css',
})
export class EventDetails implements OnInit {
  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private eventService = inject(EventService);
  private distributionService = inject(DistributionService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);
  private state = inject(EventDetailsState);
  private authService = inject(AuthService);
  private imageUploadService = inject(ImageUploadService);
  private eventListBus = inject(EventListBus);

  // Billing is visible to ROOT/ADMIN/ORGANIZER_ADMIN only — never ORGANIZER_USER or DISTRIBUTOR.
  protected readonly canViewBilling = this.authService.hasAnyRole([
    UserRole.ROOT,
    UserRole.ADMIN,
    UserRole.ORGANIZER_ADMIN,
  ]);

  // Limits is visible to ROOT/ADMIN only.
  protected readonly canViewLimits = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

  event = signal<Event | null>(null);
  isLoading = signal(true);
  statusMenuItems = signal<MenuItem[]>([]);
  changingStatus = signal(false);
  generatingShortUrls = signal(false);
  lastClickTarget: EventTarget | null = null;

  // Event image — large preview lightbox + presigned-URL upload dialog.
  protected readonly logoLoadError = signal(false);
  protected readonly uploadingLogo = signal(false);
  protected readonly imagePreviewVisible = signal(false);
  protected readonly uploadDialogVisible = signal(false);

  activeTab = activeChildRouteSignal(firstChildPath, DEFAULT_TAB);

  protected readonly getStatusSeverity = getEventStatusSeverity;
  protected readonly getStatusLabel = getEventStatusLabel;
  protected readonly buttonSize = BUTTON_SIZE;
  protected readonly isMobile = injectIsMobile();

  protected readonly eventTabs: TabItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'pi-chart-bar' },
    { id: 'participants', label: 'Participants', icon: 'pi-users' },
    { id: 'goodies', label: 'Goodies', icon: 'pi-gift' },
    { id: 'races', label: 'Races', icon: 'pi-flag' },
    { id: 'categories', label: 'Categories', icon: 'pi-tags' },
    { id: 'templates', label: 'Template', icon: 'pi-envelope' },
    { id: 'campaigns', label: 'Campaign', icon: 'pi-send' },
    { id: 'billing', label: 'Billing', icon: 'pi-receipt' },
    { id: 'limits', label: 'Limits', icon: 'pi-sliders-h' },
  ];

  // Mobile tab bar — drops tabs the current role can't view.
  protected readonly visibleTabs: TabItem[] = this.eventTabs.filter((tab) => {
    if (tab.id === 'billing') return this.canViewBilling;
    if (tab.id === 'limits') return this.canViewLimits;
    return true;
  });

  ngOnInit(): void {
    if (!Number.isFinite(this.eventId()) || this.eventId() <= 0) {
      this.router.navigate(['/events']);
      return;
    }
    this.loadEventDetails();
  }

  loadEventDetails(): void {
    this.isLoading.set(true);
    this.logoLoadError.set(false);
    this.eventService
      .getEventById(this.eventId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          this.event.set(event);
          this.state.setEvent(event);
          this.buildStatusMenuItems(event.status);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load event details');
          this.isLoading.set(false);
          this.router.navigate(['/events']);
        },
      });
  }

  onBack(): void {
    this.router.navigate(['/events']);
  }

  onTabChange(tabId: string): void {
    this.router.navigate([tabId], { relativeTo: this.route });
  }

  onEditEvent(): void {
    const ref = this.dialogService.open(EventForm, {
      header: 'Edit Event',
      width: '800px',
      breakpoints: {
        '960px': '95vw',
        '640px': '100vw',
      },
      modal: true,
      showHeader: false,
      data: {
        isEditMode: true,
        eventId: this.eventId(),
        successMessage: 'Event updated successfully',
      },
    });

    ref?.onClose.subscribe((result) => {
      if (result?.event) {
        this.loadEventDetails();
        this.toast.success(result.message || 'Event updated successfully');
      }
    });
  }

  onGenerateShortUrls(): void {
    this.generatingShortUrls.set(true);
    this.distributionService
      .generateShortUrls(this.eventId())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.generatingShortUrls.set(false)),
      )
      .subscribe({
        next: () => {
          this.toast.info(
            'Links are being generated in the background and will be ready shortly — you can keep working.',
            'Generating verification links',
          );
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to start short URL generation');
        },
      });
  }

  // ---------- Event image ----------
  protected onLogoError(): void {
    this.logoLoadError.set(true);
  }

  protected openImagePreview(): void {
    if (this.event()?.logoUrl && !this.logoLoadError()) {
      this.imagePreviewVisible.set(true);
    }
  }

  protected openUploadDialog(): void {
    this.uploadDialogVisible.set(true);
  }

  protected onLogoSelected(file: File): void {
    const id = this.eventId();
    if (!id) return;
    this.uploadingLogo.set(true);
    this.imageUploadService
      .replaceEventLogo(id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.afterLogoChange(event, 'Image updated'),
        error: (error) => {
          this.uploadingLogo.set(false);
          this.errorHandler.showError(error);
        },
      });
  }

  protected onLogoRemove(): void {
    const id = this.eventId();
    if (!id) return;
    this.uploadingLogo.set(true);
    this.imageUploadService
      .removeEventLogo(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.afterLogoChange(event, 'Image removed'),
        error: (error) => {
          this.uploadingLogo.set(false);
          this.errorHandler.showError(error);
        },
      });
  }

  private afterLogoChange(event: Event, message: string): void {
    this.uploadingLogo.set(false);
    this.logoLoadError.set(false);
    this.event.set(event);
    this.state.setEvent(event);
    this.eventListBus.publish({ action: 'updated', event });
    this.uploadDialogVisible.set(false);
    this.toast.success(message);
  }

  // ---------- Address helper ----------
  protected formatAddress(e: Event | null): string {
    if (!e) return '';
    return [e.city, e.stateProvince, e.postalCode, e.country].filter(Boolean).join(', ');
  }

  private buildStatusMenuItems(currentStatus: EventStatus): void {
    const currentEvent = this.event();
    if (!currentEvent) return;

    this.statusMenuItems.set([
      {
        label: 'Draft',
        icon: 'pi pi-file-edit',
        disabled: currentStatus === EventStatus.DRAFT,
        command: () => this.changeStatus(currentEvent, EventStatus.DRAFT),
      },
      {
        label: 'Published',
        icon: 'pi pi-check-circle',
        disabled: currentStatus === EventStatus.PUBLISHED,
        command: () => this.changeStatus(currentEvent, EventStatus.PUBLISHED),
      },
      {
        label: 'Cancelled',
        icon: 'pi pi-times-circle',
        disabled: currentStatus === EventStatus.CANCELLED,
        command: () => this.changeStatus(currentEvent, EventStatus.CANCELLED),
      },
      {
        label: 'Completed',
        icon: 'pi pi-flag',
        disabled: currentStatus === EventStatus.COMPLETED,
        command: () => this.changeStatus(currentEvent, EventStatus.COMPLETED),
      },
    ]);
  }

  showStatusMenu(menu: Menu, clickEvent: MouseEvent): void {
    this.lastClickTarget = clickEvent.currentTarget;
    menu.toggle(clickEvent);
  }

  private changeStatus(event: Event, newStatus: EventStatus): void {
    if (!event) {
      return;
    }

    const statusLabel = this.getStatusLabel(newStatus);

    this.confirmationService.confirm({
      target: this.lastClickTarget as EventTarget,
      message: `Do you want to change "${event.eventName}" status to ${statusLabel}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        label: statusLabel,
        severity: this.getStatusSeverity(newStatus),
      },
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      accept: () => {
        this.changingStatus.set(true);

        this.eventService
          .changeEventStatus(event.id, newStatus)
          .pipe(finalize(() => this.changingStatus.set(false)))
          .subscribe({
            next: (updatedEvent) => {
              this.event.set(updatedEvent);
              this.state.setEvent(updatedEvent);
              this.buildStatusMenuItems(updatedEvent.status);
              this.toast.success(`Event status changed to ${statusLabel} successfully`, 'Updated');
            },
            error: (error) => {
              this.errorHandler.showError(error, 'Failed to change event status');
            },
          });
      },
    });
  }
}
