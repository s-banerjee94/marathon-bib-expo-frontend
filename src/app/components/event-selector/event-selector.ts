import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { Event, EventStatus } from '../../core/models/event.model';
import { PageableResponse } from '../../core/models/api.model';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';
import { HighlightPipe } from '../../shared/pipes/highlight.pipe';

/**
 * Reusable Event Autocomplete Selector Component
 *
 * Provides a searchable dropdown for event selection with:
 * - Lazy loading of initial events
 * - Debounced search (300ms delay)
 * - Rich item template (event name, venue, dates)
 * - Support for pre-population via selectedEventId
 * - Optional float label mode
 * - Error message projection
 * - Shows only enabled events (disabled events are filtered out)
 * - Backend automatically excludes deleted events
 * - EventService routes to correct endpoint based on user role
 *
 * Usage:
 * ```html
 * <app-event-selector
 *   [selectedEventId]="myEventId"
 *   [organizationId]="selectedOrgId"
 *   (eventIdChange)="myEventId = $event"
 * >
 *   <p-message error severity="error">Event is required.</p-message>
 * </app-event-selector>
 * ```
 */
@Component({
  selector: 'app-event-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AutoCompleteModule,
    FloatLabelModule,
    TagModule,
    AvatarModule,
    HighlightPipe,
  ],
  templateUrl: './event-selector.html',
})
export class EventSelector implements OnInit {
  // Input properties
  @Input() label: string = 'Event';
  @Input() placeholder: string = 'Type to search events...';
  @Input() required: boolean = false;
  @Input() size: 'small' | 'large' = FORM_INPUT_SIZE;
  @Input() fluid: boolean = true;
  @Input() showFloatLabel: boolean = true;
  @Input() disabled: boolean = false;
  @Input() styleClass: string = '';
  @Input() inputId: string = 'eventAutocomplete';
  @Input() selectedEventId?: number;
  @Input() organizationId?: number; // Filter events by organization
  // Output events
  @Output() eventSelected = new EventEmitter<Event>();
  @Output() eventCleared = new EventEmitter<void>();
  @Output() eventIdChange = new EventEmitter<number | undefined>();
  // Component state
  eventSuggestions = signal<Event[]>([]);
  selectedEvent = signal<Event | null>(null);
  isLoadingEvents = signal(false);
  currentSearchTerm = signal<string>('');
  // Debounce delay for autocomplete
  readonly autocompleteDelay = 300;
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);
  // Internal state
  private hasLoadedInitialEvents = false;

  ngOnInit(): void {
    // Load event if ID is provided
    if (this.selectedEventId) {
      this.loadEventById(this.selectedEventId);
    }
  }

  /**
   * Search events based on user input
   * Backend excludes deleted events automatically
   * EventService automatically routes to correct endpoint based on user role
   */
  onEventSearch(event: { query: string }): void {
    const searchTerm = event.query?.trim() || '';
    this.currentSearchTerm.set(searchTerm);

    // Load initial events on first interaction without search term
    if (!searchTerm && !this.hasLoadedInitialEvents) {
      this.loadInitialEvents();
      return;
    }

    // Search events with the provided search term
    this.isLoadingEvents.set(true);

    const params: any = {
      page: 0,
      size: 50,
      search: searchTerm,
      sort: ['eventStartDate,desc'],
    };

    // Add organization filter if provided
    if (this.organizationId) {
      params.organizationId = this.organizationId;
    }

    this.eventService.searchEvents(params).subscribe({
      next: (response: PageableResponse<Event>) => {
        // Filter to only show enabled events
        const enabledEvents = response.content.filter((event) => event.enabled);
        this.eventSuggestions.set(enabledEvents);
        this.isLoadingEvents.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to search events');
        this.isLoadingEvents.set(false);
      },
    });
  }

  /**
   * Handle event selection
   */
  onEventSelect(event: AutoCompleteSelectEvent): void {
    if (event && event.value && event.value.id) {
      this.selectedEvent.set(event.value);
      this.eventSelected.emit(event.value);
      this.eventIdChange.emit(event.value.id);
    }
  }

  /**
   * Handle event clear
   */
  onEventClear(): void {
    this.selectedEvent.set(null);
    this.currentSearchTerm.set('');
    this.eventCleared.emit();
    this.eventIdChange.emit(undefined);
  }

  /**
   * Reset the selector (useful when organization changes)
   */
  reset(): void {
    this.selectedEvent.set(null);
    this.eventSuggestions.set([]);
    this.currentSearchTerm.set('');
    this.hasLoadedInitialEvents = false;
    this.eventIdChange.emit(undefined);
  }

  /**
   * Get tag severity based on event status
   */
  getStatusSeverity(status: EventStatus): 'success' | 'info' | 'warn' | 'danger' {
    switch (status) {
      case EventStatus.PUBLISHED:
        return 'success';
      case EventStatus.DRAFT:
        return 'info';
      case EventStatus.COMPLETED:
        return 'warn';
      case EventStatus.CANCELLED:
        return 'danger';
      default:
        return 'info';
    }
  }

  /**
   * Get initials from event name
   */
  getInitials(name: string): string {
    if (!name) return '?';

    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  /**
   * Load event by ID for pre-population
   */
  private loadEventById(id: number): void {
    this.eventService.getEventById(id).subscribe({
      next: (event) => {
        this.selectedEvent.set(event);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load event');
      },
    });
  }

  /**
   * Load initial 50 events on first dropdown interaction
   * Backend excludes deleted events automatically
   * EventService automatically routes to correct endpoint based on user role
   */
  private loadInitialEvents(): void {
    this.isLoadingEvents.set(true);

    const params: any = {
      page: 0,
      size: 50,
      sort: ['eventStartDate,desc'],
    };

    // Add organization filter if provided
    if (this.organizationId) {
      params.organizationId = this.organizationId;
    }

    this.eventService.searchEvents(params).subscribe({
      next: (response: PageableResponse<Event>) => {
        // Filter to only show enabled events
        const enabledEvents = response.content.filter((event) => event.enabled);
        this.eventSuggestions.set(enabledEvents);
        this.isLoadingEvents.set(false);
        this.hasLoadedInitialEvents = true;
      },
      error: (error) => {
        this.isLoadingEvents.set(false);
        this.errorHandler.showError(error, 'Failed to load events');
      },
    });
  }
}
