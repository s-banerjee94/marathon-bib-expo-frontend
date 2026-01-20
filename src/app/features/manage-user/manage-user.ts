import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  CreateUserRequest,
  UserRole,
  ROLE_AVAILABILITY,
  RoleOption,
} from '../../core/models/user.model';
import { Organization } from '../../core/models/organization.model';
import { PageableResponse } from '../../core/models/api.model';
import { UserService } from '../../core/services/user.service';
import { OrganizationService } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import {
  roleRequiresOrganization,
  roleRequiresEmailPhone,
  buildOrganizationSearchParams,
  AUTOCOMPLETE_DELAY,
} from './manage-user.utils';
import {
  shouldShowError,
  showSuccessAndNavigate,
  initializeErrorHandler,
} from '../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';

@Component({
  selector: 'app-manage-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    FloatLabelModule,
    ButtonModule,
    MessageModule,
    CardModule,
    SelectModule,
    AutoCompleteModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './manage-user.html',
  styleUrl: './manage-user.css',
})
export class ManageUser implements OnInit {
  private userService = inject(UserService);
  private organizationService = inject(OrganizationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  // Form data as plain object for ngModel binding
  user: CreateUserRequest = {
    username: '',
    password: '',
    email: '',
    fullName: '',
    phoneNumber: '',
    role: UserRole.ADMIN,
    organizationId: undefined,
  };

  // Component state as signals
  isSubmitting = signal(false);
  isLoadingOrganizations = signal(false);
  currentUserRole = signal<UserRole | null>(null);
  availableRoles = signal<RoleOption[]>([]);
  organizationSuggestions = signal<Organization[]>([]);
  selectedRole = signal<UserRole | null>(UserRole.ADMIN);
  selectedOrganization = signal<Organization | null>(null);

  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;

  // Constants for template
  readonly autocompleteDelay = AUTOCOMPLETE_DELAY;

  private hasLoadedInitialOrganizations = false;

  ngOnInit(): void {
    initializeErrorHandler(this.errorHandler, this.messageService);

    this.initializeCurrentUserRole();
    this.initializeAvailableRoles();
    this.onRoleSelected();
  }

  private initializeCurrentUserRole(): void {
    const role = this.authService.getCurrentRole();
    this.currentUserRole.set(role);
  }

  private initializeAvailableRoles(): void {
    const currentRole = this.currentUserRole();
    const rolesForCurrentUser = currentRole ? ROLE_AVAILABILITY[currentRole] : [];
    this.availableRoles.set(rolesForCurrentUser || []);
  }

  private loadInitialOrganizations(): void {
    this.isLoadingOrganizations.set(true);
    const params = buildOrganizationSearchParams();

    this.organizationService.searchOrganizations(params).subscribe({
      next: (response: PageableResponse<Organization>) => {
        this.organizationSuggestions.set(response.content);
        this.isLoadingOrganizations.set(false);
        this.hasLoadedInitialOrganizations = true;
      },
      error: (error) => {
        this.isLoadingOrganizations.set(false);
        this.errorHandler.showError(error, 'Error', {
          customMessage: 'Failed to load organizations. Please try again.',
        });
        // Don't set hasLoadedInitialOrganizations to true on error, so user can retry
      },
    });
  }

  onRoleSelected(): void {
    if (this.selectedRole()) {
      this.user.role = this.selectedRole()!;

      // Clear organization selection and suggestions when role changes
      this.selectedOrganization.set(null);
      this.user.organizationId = undefined;
      this.organizationSuggestions.set([]);

      // Auto-set organizationId for org-based roles
      const currentRole = this.currentUserRole();
      if (currentRole === UserRole.ORGANIZER_ADMIN || currentRole === UserRole.ORGANIZER_USER) {
        this.user.organizationId = this.getCurrentOrganizationId();
      }

      // Reset initial load flag when role changes
      this.hasLoadedInitialOrganizations = false;
    }
  }

  showOrganizationDropdown(): boolean {
    const currentRole = this.currentUserRole();

    // Only show dropdown if current user is ROOT/ADMIN AND selected role needs organization
    if (currentRole === UserRole.ROOT || currentRole === UserRole.ADMIN) {
      return this.selectedRole() !== null && roleRequiresOrganization(this.selectedRole());
    }

    return false;
  }

  getCurrentOrganizationId(): number | undefined {
    return this.authService.currentUser()?.organizationId;
  }

  onOrganizationSearch(event: { query: string }): void {
    const searchTerm = event.query?.trim() || '';

    // Load initial organizations on first interaction (when dropdown clicked with no search)
    if (!searchTerm && !this.hasLoadedInitialOrganizations) {
      this.loadInitialOrganizations();
      return;
    }

    // Search organizations with the provided search term
    this.isLoadingOrganizations.set(true);
    const params = buildOrganizationSearchParams(searchTerm);

    this.organizationService.searchOrganizations(params).subscribe({
      next: (response: PageableResponse<Organization>) => {
        this.organizationSuggestions.set(response.content);
        this.isLoadingOrganizations.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Search Error', {
          customMessage: 'Failed to search organizations. Please try again.',
        });
        this.isLoadingOrganizations.set(false);
      },
    });
  }

  onOrganizationSelect(event: AutoCompleteSelectEvent): void {
    if (event && event.value && event.value.id) {
      this.user.organizationId = event.value.id;
      this.selectedOrganization.set(event.value);
    }
  }

  onOrganizationClear(): void {
    this.user.organizationId = undefined;
    this.selectedOrganization.set(null);
  }

  isEmailRequired(): boolean {
    return roleRequiresEmailPhone(this.selectedRole());
  }

  isPhoneRequired(): boolean {
    return roleRequiresEmailPhone(this.selectedRole());
  }

  shouldShowError = shouldShowError;

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    // Validate organizationId is set when required (not needed for ROOT/ADMIN creating ROOT/ADMIN)
    if (roleRequiresOrganization(this.selectedRole()) && !this.user.organizationId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Organization is required. Please select an organization.',
      });
      return;
    }

    this.isSubmitting.set(true);

    this.userService.createUser(this.user).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        showSuccessAndNavigate(
          this.messageService,
          'User created successfully',
          this.router,
          this.authService.getDashboardRoute(),
        );
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error, 'Error');
      },
    });
  }

  getTitle(): string {
    return 'Create User';
  }

  getSubmitButtonText(): string {
    return this.isSubmitting() ? 'Creating...' : 'Create User';
  }
}
