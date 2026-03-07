import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  CreateUserRequest,
  ROLE_AVAILABILITY,
  RoleOption,
  UpdateUserRequest,
  User,
  UserRole,
} from '../../core/models/user.model';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { roleRequiresEmailPhone, roleRequiresOrganization } from './user-form.utils';
import { initializeErrorHandler, shouldShowError } from '../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';

@Component({
  selector: 'app-user-form',
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
    SkeletonModule,
    OrganizationSelector,
  ],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css',
})
export class UserForm implements OnInit {
  // Optional injection for dialog mode
  public dialogConfig = inject(DynamicDialogConfig, { optional: true });
  public dialogRef = inject(DynamicDialogRef, { optional: true });
  isDialogMode = signal(false);
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
  isEditMode = signal(false);
  userId = signal<number | null>(null);
  isLoading = signal(false);
  currentUserRole = signal<UserRole | null>(null);
  availableRoles = signal<RoleOption[]>([]);
  selectedRole = signal<UserRole | null>(UserRole.ADMIN);
  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  ngOnInit(): void {
    initializeErrorHandler(this.errorHandler, this.messageService);

    this.initializeCurrentUserRole();
    this.initializeAvailableRoles();

    // Check if opened in dialog mode
    if (this.dialogConfig?.data) {
      this.isDialogMode.set(true);
      const dialogData = this.dialogConfig.data;

      if (dialogData.isEditMode && dialogData.userId) {
        this.isEditMode.set(true);
        this.userId.set(dialogData.userId);
        this.loadUserData(dialogData.userId);
      }
    } else {
      // Route-based mode (existing behavior)
      this.isDialogMode.set(false);
      const idParam = this.route.snapshot.paramMap.get('id');

      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) {
          this.isEditMode.set(true);
          this.userId.set(id);
          this.loadUserData(id);
        } else {
          // Invalid ID, redirect to create mode
          this.router.navigate(['/user-form']);
        }
      } else {
        // Create mode - default state
        this.isEditMode.set(false);
        this.userId.set(null);
      }
    }

    this.onRoleSelected();
  }

  onRoleSelected(): void {
    if (this.selectedRole()) {
      this.user.role = this.selectedRole()!;

      // Clear organization selection when role changes
      this.user.organizationId = undefined;

      // Auto-set organizationId for org-based roles
      const currentRole = this.currentUserRole();
      if (currentRole === UserRole.ORGANIZER_ADMIN || currentRole === UserRole.ORGANIZER_USER) {
        this.user.organizationId = this.getCurrentOrganizationId();
      }
    }
  }

  showOrganizationDropdown(): boolean {
    if (this.isEditMode()) return false;

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

  isEmailRequired(): boolean {
    return roleRequiresEmailPhone(this.selectedRole());
  }

  isPhoneRequired(): boolean {
    return roleRequiresEmailPhone(this.selectedRole());
  }

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

    if (this.isEditMode() && this.userId()) {
      // Build update request — only send fields the backend accepts (PATCH /api/users/{id})
      const updateRequest: UpdateUserRequest = {
        email: this.user.email || undefined,
        fullName: this.user.fullName || undefined,
        phoneNumber: this.user.phoneNumber || undefined,
      };
      // Only include password if the user typed one
      if (this.user.password) {
        updateRequest.password = this.user.password;
      }

      this.userService.updateUser(this.userId()!, updateRequest).subscribe({
        next: (updatedUser: User) => {
          this.isSubmitting.set(false);

          if (this.isDialogMode() && this.dialogRef) {
            const successMessage = this.dialogConfig?.data?.successMessage;
            this.dialogRef!.close({ user: updatedUser, message: successMessage });
          } else {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'User updated successfully',
            });
            setTimeout(() => this.location.back(), 1500);
          }
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.errorHandler.showError(error, 'Error');
        },
      });
    } else {
      // Create mode
      this.userService.createUser(this.user).subscribe({
        next: (createdUser: User) => {
          this.isSubmitting.set(false);

          // Close dialog or reset form based on mode
          if (this.isDialogMode() && this.dialogRef) {
            // Close immediately - parent will show toast with custom message from dialog data
            const successMessage = this.dialogConfig?.data?.successMessage;
            this.dialogRef!.close({ user: createdUser, message: successMessage });
          } else {
            // Show toast for non-dialog mode
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'User created successfully',
            });
            // Reset form for creating another user
            setTimeout(() => {
              form.resetForm();
              this.user = {
                username: '',
                password: '',
                email: '',
                fullName: '',
                phoneNumber: '',
                role: UserRole.ADMIN,
                organizationId: undefined,
              };
              this.selectedRole.set(UserRole.ADMIN);
            }, 1500);
          }
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.errorHandler.showError(error, 'Error');
        },
      });
    }
  }

  getTitle(): string {
    return this.isEditMode() ? 'Edit User' : 'Create User';
  }

  getSubmitButtonText(): string {
    if (this.isSubmitting()) {
      return this.isEditMode() ? 'Updating...' : 'Creating...';
    }
    return this.isEditMode() ? 'Update User' : 'Create User';
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

  private loadUserData(id: number): void {
    this.isLoading.set(true);

    this.userService.getUserById(id).subscribe({
      next: (user: User) => {
        this.populateFormFromUser(user);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error, 'Error', {
          customMessage: 'Failed to load user data. Please try again.',
        });
        if (!this.isDialogMode()) {
          this.router.navigate([this.authService.getDashboardRoute()]);
        }
      },
    });
  }

  private populateFormFromUser(userData: User): void {
    this.user = {
      username: userData.username,
      password: '', // Password not returned from backend
      email: userData.email,
      fullName: userData.fullName,
      phoneNumber: userData.phoneNumber,
      role: userData.role,
      organizationId: userData.organizationId,
    };

    this.selectedRole.set(userData.role);
  }
}
