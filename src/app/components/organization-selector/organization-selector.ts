import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { Organization } from '../../core/models/organization.model';
import { PageableResponse } from '../../core/models/api.model';
import { OrganizationService } from '../../core/services/organization.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';
import { HighlightPipe } from '../../shared/pipes/highlight.pipe';

/**
 * Reusable Organization Autocomplete Selector Component
 *
 * Provides a searchable dropdown for organization selection with:
 * - Lazy loading of initial organizations
 * - Debounced search (300ms delay)
 * - Rich item template (org name, email, phone)
 * - Support for pre-population via selectedOrganizationId
 * - Optional float label mode
 * - Error message projection
 *
 * Usage:
 * ```html
 * <app-organization-selector
 *   [selectedOrganizationId]="myOrgId"
 *   (organizationIdChange)="myOrgId = $event"
 * >
 *   <p-message error severity="error">Organization is required.</p-message>
 * </app-organization-selector>
 * ```
 */
@Component({
  selector: 'app-organization-selector',
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
  templateUrl: './organization-selector.html',
})
export class OrganizationSelector implements OnInit {
  private organizationService = inject(OrganizationService);
  private errorHandler = inject(ErrorHandlerService);

  // Input properties
  @Input() label: string = 'Organization';
  @Input() placeholder: string = 'Type to search organizations...';
  @Input() required: boolean = false;
  @Input() size: 'small' | 'large' = FORM_INPUT_SIZE;
  @Input() fluid: boolean = true;
  @Input() showFloatLabel: boolean = true;
  @Input() disabled: boolean = false;
  @Input() styleClass: string = '';
  @Input() inputId: string = 'organizationAutocomplete';
  @Input() selectedOrganizationId?: number;

  // Output events
  @Output() organizationSelected = new EventEmitter<Organization>();
  @Output() organizationCleared = new EventEmitter<void>();
  @Output() organizationIdChange = new EventEmitter<number | undefined>();

  // Component state
  organizationSuggestions = signal<Organization[]>([]);
  selectedOrganization = signal<Organization | null>(null);
  isLoadingOrganizations = signal(false);
  currentSearchTerm = signal<string>('');

  // Internal state
  private hasLoadedInitialOrganizations = false;

  // Debounce delay for autocomplete
  readonly autocompleteDelay = 300;

  ngOnInit(): void {
    // Load organization if ID is provided
    if (this.selectedOrganizationId) {
      this.loadOrganizationById(this.selectedOrganizationId);
    }
  }

  /**
   * Load organization by ID for pre-population
   */
  private loadOrganizationById(id: number): void {
    this.organizationService.getOrganizationById(id).subscribe({
      next: (org) => {
        this.selectedOrganization.set(org);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load organization');
      },
    });
  }

  /**
   * Load initial 50 organizations on first dropdown interaction
   */
  private loadInitialOrganizations(): void {
    this.isLoadingOrganizations.set(true);
    const params = {
      page: 0,
      size: 50,
      enabled: true,
      sort: ['updatedAt,desc', 'createdAt,desc'],
    };

    this.organizationService.searchOrganizations(params).subscribe({
      next: (response: PageableResponse<Organization>) => {
        this.organizationSuggestions.set(response.content);
        this.isLoadingOrganizations.set(false);
        this.hasLoadedInitialOrganizations = true;
      },
      error: (error) => {
        this.isLoadingOrganizations.set(false);
        this.errorHandler.showError(error, 'Failed to load organizations');
      },
    });
  }

  /**
   * Search organizations based on user input
   */
  onOrganizationSearch(event: { query: string }): void {
    const searchTerm = event.query?.trim() || '';
    this.currentSearchTerm.set(searchTerm);

    // Load initial organizations on first interaction without search term
    if (!searchTerm && !this.hasLoadedInitialOrganizations) {
      this.loadInitialOrganizations();
      return;
    }

    // Search organizations with the provided search term
    this.isLoadingOrganizations.set(true);
    const params = {
      page: 0,
      size: 50,
      search: searchTerm,
      enabled: true,
      sort: ['updatedAt,desc', 'createdAt,desc'],
    };

    this.organizationService.searchOrganizations(params).subscribe({
      next: (response: PageableResponse<Organization>) => {
        this.organizationSuggestions.set(response.content);
        this.isLoadingOrganizations.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to search organizations');
        this.isLoadingOrganizations.set(false);
      },
    });
  }

  /**
   * Handle organization selection
   */
  onOrganizationSelect(event: AutoCompleteSelectEvent): void {
    if (event && event.value && event.value.id) {
      this.selectedOrganization.set(event.value);
      this.organizationSelected.emit(event.value);
      this.organizationIdChange.emit(event.value.id);
    }
  }

  /**
   * Handle organization clear
   */
  onOrganizationClear(): void {
    this.selectedOrganization.set(null);
    this.currentSearchTerm.set('');
    this.organizationCleared.emit();
    this.organizationIdChange.emit(undefined);
  }

  /**
   * Get initials from organization name
   */
  getInitials(name: string): string {
    if (!name) return '?';

    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
}
