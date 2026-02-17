import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { Menu } from 'primeng/menu';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { Event, EventStatus } from '../../../core/models/event.model';
import { Race } from '../../../core/models/race.model';
import { EventService } from '../../../core/services/event.service';
import { RaceService } from '../../../core/services/race.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { RaceSection } from '../race-section/race-section';
import { CategorySection } from '../category-section/category-section';
import { SmsTemplateSection } from '../sms-template-section/sms-template-section';
import { FormatDateTimePipe } from '../../../shared/pipes/format-date-time.pipe';
import {
  getEventStatusLabel,
  getEventStatusSeverity,
} from '../../../shared/utils/event-status.utils';
import { EventForm } from '../../event-form/event-form';

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
    RaceSection,
    CategorySection,
    SmsTemplateSection,
    FormatDateTimePipe,
  ],
  providers: [DialogService, MessageService, ConfirmationService],
  templateUrl: './event-details.html',
  styleUrl: './event-details.css',
})
export class EventDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private eventService = inject(EventService);
  private raceService = inject(RaceService);
  private errorHandler = inject(ErrorHandlerService);
  private dialogService = inject(DialogService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  event = signal<Event | null>(null);
  races = signal<Race[]>([]);
  selectedRace = signal<Race | null>(null);
  isLoading = signal(true);
  eventId = signal<number>(0);
  statusMenuItems = signal<MenuItem[]>([]);
  changingStatus = signal(false);
  lastClickTarget: EventTarget | null = null;

  EventStatus = EventStatus;
  getStatusSeverity = getEventStatusSeverity;
  getStatusLabel = getEventStatusLabel;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.eventId.set(Number(id));
      this.loadEventDetails();
    } else {
      this.router.navigate(['/events']);
    }
  }

  loadEventDetails(): void {
    this.isLoading.set(true);
    this.eventService.getEventById(this.eventId()).subscribe({
      next: (event) => {
        this.event.set(event);
        this.buildStatusMenuItems(event.status);
        this.isLoading.set(false);
        this.loadRaces();
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load event details');
        this.isLoading.set(false);
        this.router.navigate(['/events']);
      },
    });
  }

  loadRaces(): void {
    this.raceService.getRacesByEventId(this.eventId()).subscribe({
      next: (races: Race[]) => {
        this.races.set(races);
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to load races');
      },
    });
  }

  onRaceSelected(race: Race): void {
    this.selectedRace.set(race);
  }

  onBack(): void {
    this.router.navigate(['/events']);
  }

  /**
   * Open event edit dialog
   */
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
        // Reload event details after successful update
        this.loadEventDetails();
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: result.message || 'Event updated successfully',
        });
      }
    });
  }

  /**
   * Build status menu items - show all statuses with current one disabled
   * Matches pattern from event-list component
   */
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

  /**
   * Show status menu with click tracking
   * Matches pattern from event-list component
   */
  showStatusMenu(menu: Menu, clickEvent: MouseEvent): void {
    this.lastClickTarget = clickEvent.currentTarget;
    menu.toggle(clickEvent);
  }

  /**
   * Change event status with confirmation
   * Matches pattern from event-list component
   */
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

        this.eventService.changeEventStatus(event.id, newStatus).subscribe({
          next: (updatedEvent) => {
            this.event.set(updatedEvent);
            this.buildStatusMenuItems(updatedEvent.status);
            this.changingStatus.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: `Event status changed to ${statusLabel} successfully`,
            });
          },
          error: (error) => {
            this.changingStatus.set(false);
            this.errorHandler.showError(error, 'Failed to change event status');
          },
        });
      },
    });
  }
}
