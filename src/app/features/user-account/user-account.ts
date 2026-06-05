import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { UserService } from '../../core/services/user.service';
import { ImageUploadService } from '../../core/services/image-upload.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { ROLE_LABELS, UpdateUserRequest, User } from '../../core/models/user.model';
import { shouldShowError } from '../../shared/utils/form.utils';
import { getInitials } from '../../shared/utils/initials.util';
import { userCanManage } from '../../shared/utils/user-permissions.utils';
import { roleRequiresEmailPhone } from '../users/user-form/user-form.utils';
import { UserListBus } from '../users/user-list-bus.service';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 100;

/**
 * Full-page view/edit for a single user, opened from the user table (row "edit").
 * Mirrors the self-service Profile page but operates on a target user loaded by
 * route id, gated by userCanManage. Username, role, and organization are
 * read-only (immutable via the backend). On success it publishes to UserListBus
 * so the list patches the row in place without refetching.
 */
@Component({
  selector: 'app-user-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    AvatarModule,
    CardModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    MessageModule,
    PasswordModule,
    ProgressSpinnerModule,
    SkeletonModule,
    DefaultValuePipe,
  ],
  templateUrl: './user-account.html',
  styleUrl: './user-account.css',
})
export class UserAccount implements OnInit {
  @ViewChild('avatarInput') private avatarInput!: ElementRef<HTMLInputElement>;

  private userService = inject(UserService);
  private imageUploadService = inject(ImageUploadService);
  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private userListBus = inject(UserListBus);

  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;

  user = signal<User | null>(null);
  isLoading = signal(true);
  savingProfile = signal(false);
  savingPassword = signal(false);
  avatarPending = signal(false);

  // Editable form models (kept separate from the loaded user so Reset works).
  profile = { fullName: '', email: '', phoneNumber: '' };
  passwords = { newPassword: '', confirmPassword: '' };

  roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? ROLE_LABELS[role] : '';
  });
  avatarLabel = computed(() => getInitials(this.user()?.fullName ?? this.user()?.username));
  private failedAvatarUrl = signal<string | null>(null);
  avatarImage = computed(() => {
    const url = this.user()?.profilePictureUrl;
    const valid = url && url.trim() ? url : undefined;
    return valid && valid !== this.failedAvatarUrl() ? valid : undefined;
  });
  // Email/phone are mandatory for ADMIN and organizer roles (mirrors the backend).
  contactRequired = computed(() => roleRequiresEmailPhone(this.user()?.role ?? null));

  get newPasswordValid(): boolean {
    const value = this.passwords.newPassword;
    return value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
  }

  get passwordsMatch(): boolean {
    return this.passwords.newPassword === this.passwords.confirmPassword;
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    if (!Number.isFinite(id)) {
      this.isLoading.set(false);
      this.location.back();
      return;
    }
    this.loadUser(id);
  }

  private loadUser(id: number): void {
    this.isLoading.set(true);
    this.userService.getUserById(id).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        if (!userCanManage(this.authService.currentUser(), user)) {
          this.toast.error('You do not have permission to manage this user.');
          this.location.back();
          return;
        }
        this.user.set(user);
        this.populateProfile(user);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  // ── Personal information ───────────────────────────────────────────────────

  onSaveProfile(form: NgForm): void {
    if (form.invalid) return;
    const id = this.user()?.id;
    if (id == null) return;

    const request: UpdateUserRequest = {
      fullName: this.profile.fullName.trim() || undefined,
      email: this.profile.email.trim() || undefined,
      phoneNumber: this.profile.phoneNumber.trim() || undefined,
    };

    this.savingProfile.set(true);
    this.userService.updateUser(id, request).subscribe({
      next: (updated) => {
        this.savingProfile.set(false);
        this.user.set(updated);
        this.populateProfile(updated);
        form.form.markAsPristine();
        this.userListBus.publish({ action: 'updated', user: updated });
        this.toast.success('User updated');
      },
      error: (error) => {
        this.savingProfile.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  resetProfile(form: NgForm): void {
    const current = this.user();
    if (current) this.populateProfile(current);
    form.form.markAsPristine();
  }

  // ── Password ───────────────────────────────────────────────────────────────

  onSavePassword(form: NgForm): void {
    if (!this.newPasswordValid || !this.passwordsMatch) return;
    const id = this.user()?.id;
    if (id == null) return;

    this.savingPassword.set(true);
    this.userService.updateUser(id, { password: this.passwords.newPassword }).subscribe({
      next: (updated) => {
        this.savingPassword.set(false);
        this.passwords = { newPassword: '', confirmPassword: '' };
        form.resetForm();
        this.userListBus.publish({ action: 'updated', user: updated });
        this.toast.success('Password updated');
      },
      error: (error) => {
        this.savingPassword.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────

  openAvatarPicker(): void {
    if (this.avatarPending()) return;
    this.avatarInput.nativeElement.click();
  }

  onAvatarInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.onAvatarSelected(file);
    input.value = '';
  }

  onAvatarImageError(): void {
    this.failedAvatarUrl.set(this.user()?.profilePictureUrl ?? null);
  }

  onAvatarSelected(file: File): void {
    const id = this.user()?.id;
    if (id == null) return;
    this.avatarPending.set(true);
    this.imageUploadService.replaceUserAvatar(id, file).subscribe({
      next: (user) => this.afterAvatarChange(user, 'Profile picture updated'),
      error: (error) => {
        this.avatarPending.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onAvatarRemove(): void {
    const id = this.user()?.id;
    if (id == null) return;
    this.avatarPending.set(true);
    this.imageUploadService.removeUserAvatar(id).subscribe({
      next: (user) => this.afterAvatarChange(user, 'Profile picture removed'),
      error: (error) => {
        this.avatarPending.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  goBack(): void {
    this.location.back();
  }

  private populateProfile(user: User): void {
    this.profile = {
      fullName: user.fullName ?? '',
      email: user.email ?? '',
      phoneNumber: user.phoneNumber ?? '',
    };
  }

  private afterAvatarChange(user: User, message: string): void {
    this.avatarPending.set(false);
    this.failedAvatarUrl.set(null);
    this.user.set(user);
    this.userListBus.publish({ action: 'updated', user });
    this.toast.success(message);
  }
}
