import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, finalize, map, startWith } from 'rxjs/operators';
import {
  ActivatedRoute,
  NavigationEnd,
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
import { ConfirmationService, MenuItem } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { Event, EventStatus } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
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

const DEFAULT_TAB = 'races';

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
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormatEventDateTimePipe,
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
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);
  private state = inject(EventDetailsState);

  event = signal<Event | null>(null);
  isLoading = signal(true);
  statusMenuItems = signal<MenuItem[]>([]);
  changingStatus = signal(false);
  lastClickTarget: EventTarget | null = null;

  activeTab = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_TAB),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_TAB },
  );

  protected readonly getStatusSeverity = getEventStatusSeverity;
  protected readonly getStatusLabel = getEventStatusLabel;
  protected readonly buttonSize = BUTTON_SIZE;

  ngOnInit(): void {
    if (!Number.isFinite(this.eventId()) || this.eventId() <= 0) {
      this.router.navigate(['/events']);
      return;
    }
    this.loadEventDetails();
  }

  loadEventDetails(): void {
    this.isLoading.set(true);
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

  onEditEvent(): void {
    const ref = this.dialogService.open(EventForm, {
      header: 'Edit Event',
      width: '800px',
      modal: true,
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
