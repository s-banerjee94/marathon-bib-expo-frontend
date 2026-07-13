import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RadioButtonModule } from 'primeng/radiobutton';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateUserRequest,
  ROLE_AVAILABILITY,
  RoleOption,
  User,
  UserRole,
} from '../../../core/models/user.model';
import { EventStatus } from '../../../core/models/event.model';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  roleRequiresEmailPhone,
  roleRequiresEvent,
  roleRequiresOrganization,
} from './user-form.utils';
import { UserListBus } from '../user-list-bus.service';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { EventSelector } from '../../../layout/event-selector/event-selector';

/**
 * Create-user form, always rendered inside a dialog (DialogService) from UserList.
 * Editing a user is handled by the full-page UserAccount view, so this form is
 * create-only. Dialog data may carry an optional `role` to preselect.
 */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    FloatLabelModule,
    ButtonModule,
    MessageModule,
    RadioButtonModule,
    OrganizationSelector,
    EventSelector,
  ],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css',
})
export class UserForm implements OnInit {
  private dialogConfig = inject(DynamicDialogConfig, { optional: true });
  private dialogRef = inject(DynamicDialogRef, { optional: true });

  @ViewChild(EventSelector) private eventSelector?: EventSelector;

  // Form data as a plain object for ngModel binding.
  user: CreateUserRequest = {
    username: '',
    password: '',
    email: '',
    fullName: '',
    phoneNumber: '',
    role: UserRole.ADMIN,
    organizationId: undefined,
    eventId: undefined,
  };
  isSubmitting = signal(false);
  currentUserRole = signal<UserRole | null>(null);
  availableRoles = signal<RoleOption[]>([]);
  selectedRole = signal<UserRole | null>(null);

  // Hide completed/cancelled events from the distributor event picker.
  readonly excludedEventStatuses = [EventStatus.COMPLETED, EventStatus.CANCELLED];

  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;

  private userService = inject(UserService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);
  private userListBus = inject(UserListBus);

  ngOnInit(): void {
    const role = this.authService.getCurrentRole();
    this.currentUserRole.set(role);
    const roles = role ? (ROLE_AVAILABILITY[role] ?? []) : [];
    this.availableRoles.set(roles);

    // Preselect a role ONLY when one was passed via dialog data (the dashboard
    // quick-create shortcuts do this). Opening the generic "Create User" from the
    // users route passes no role, so the radios start with nothing checked.
    const requested = this.dialogConfig?.data?.role as UserRole | undefined;
    const initial = roles.find((r) => r.value === requested)?.value ?? null;
    this.selectedRole.set(initial);
    this.onRoleSelected();
  }

  onRoleChange(role: UserRole): void {
    this.selectedRole.set(role);
    this.onRoleSelected();
  }

  onRoleSelected(): void {
    const role = this.selectedRole();
    if (!role) return;
    this.user.role = role;

    // Clear organization + event selection when role changes.
    this.user.organizationId = undefined;
    this.user.eventId = undefined;
    this.eventSelector?.reset();

    // Auto-set organizationId for org-scoped current users.
    const currentRole = this.currentUserRole();
    if (currentRole === UserRole.ORGANIZER_ADMIN || currentRole === UserRole.ORGANIZER_USER) {
      this.user.organizationId = this.authService.currentUser()?.organizationId;
    }
  }

  // ROOT/ADMIN change the organization via the dropdown; clear the dependent event
  // so a stale selection from another org can't be submitted.
  onOrganizationChanged(organizationId: number | undefined): void {
    this.user.organizationId = organizationId;
    this.user.eventId = undefined;
    this.eventSelector?.reset();
  }

  showOrganizationDropdown(): boolean {
    const currentRole = this.currentUserRole();
    // Only ROOT/ADMIN pick an organization, and only when the selected role needs one.
    if (currentRole === UserRole.ROOT || currentRole === UserRole.ADMIN) {
      return this.selectedRole() !== null && roleRequiresOrganization(this.selectedRole());
    }
    return false;
  }

  // Distributors are bound to one event, so the picker shows for that role only.
  showEventPicker(): boolean {
    return roleRequiresEvent(this.selectedRole());
  }

  // Email and phone are mandatory for ADMIN and organizer roles (mirrors the backend).
  contactRequired(): boolean {
    return roleRequiresEmailPhone(this.selectedRole());
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    // A role must be picked (the radios start unchecked for the generic create).
    if (!this.selectedRole()) return;

    // Validate organizationId is set when the role requires it.
    if (roleRequiresOrganization(this.selectedRole()) && !this.user.organizationId) {
      this.toast.warn('Organization is required. Please select an organization.');
      return;
    }

    // A distributor must be bound to an event.
    if (roleRequiresEvent(this.selectedRole()) && !this.user.eventId) {
      this.toast.warn('Event is required. Please select an event for the distributor.');
      return;
    }

    this.isSubmitting.set(true);
    this.userService.createUser(this.user).subscribe({
      next: (createdUser: User) => {
        this.isSubmitting.set(false);
        this.userListBus.publish({ action: 'created', user: createdUser });
        this.toast.success('User created successfully', 'Created');
        this.dialogRef?.close(createdUser);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error, 'Error');
      },
    });
  }
}
