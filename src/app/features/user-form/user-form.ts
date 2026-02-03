import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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
  User,
  UserRole,
  ROLE_AVAILABILITY,
  RoleOption,
} from '../../core/models/user.model';
import { Organization } from '../../core/models/organization.model';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { roleRequiresOrganization, roleRequiresEmailPhone } from './user-form.utils';
import { shouldShowError, initializeErrorHandler } from '../../shared/utils/form.utils';
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
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

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

    if (this.isEditMode() && this.userId()) {
      // Edit mode - Note: Backend needs updateUser endpoint
      // For now, show error that edit is not implemented
      this.isSubmitting.set(false);
      this.messageService.add({
        severity: 'error',
        summary: 'Not Implemented',
        detail: 'User editing is not yet implemented in the backend API.',
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
}
