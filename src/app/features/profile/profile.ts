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
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ImageUploadService } from '../../core/services/image-upload.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ToastService } from '../../core/services/toast.service';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { EventNamePipe } from '../../shared/pipes/event-name-pipe';
import { EventLogoPipe } from '../../shared/pipes/event-logo-pipe';
import { InitialsPipe } from '../../shared/pipes/initials-pipe';
import { ImageCropDialog } from '../../shared/components/image-crop-dialog/image-crop-dialog';
import { ROLE_LABELS, UpdateUserRequest, User, UserRole } from '../../core/models/user.model';
import { buildDirtyPatch, shouldShowError } from '../../shared/utils/form.utils';
import { getInitials } from '../../shared/utils/initials.util';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 100;

/**
 * Account/settings page for the currently authenticated user. Lets a user view
 * and update their own profile — avatar, personal details, and password.
 * (No email/password verification step for now — updates apply immediately.)
 */
@Component({
  selector: 'app-profile',
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
    DialogModule,
    DefaultValuePipe,
    EventNamePipe,
    EventLogoPipe,
    InitialsPipe,
    ImageCropDialog,
  ],
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  @ViewChild('avatarInput') private avatarInput!: ElementRef<HTMLInputElement>;

  private authService = inject(AuthService);
  private userService = inject(UserService);
  private imageUploadService = inject(ImageUploadService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private location = inject(Location);

  user = this.authService.currentUser;
  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;

  // Editable form models (kept separate from the cached user so Reset works).
  profile = { fullName: '', email: '', phoneNumber: '' };
  passwords = { newPassword: '', confirmPassword: '' };

  savingProfile = signal(false);
  savingPassword = signal(false);
  avatarPending = signal(false);
  imagePreviewVisible = signal(false);
  cropVisible = signal(false);
  cropFile = signal<File | null>(null);

  roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? ROLE_LABELS[role] : '';
  });
  avatarLabel = computed(() => getInitials(this.user()?.fullName ?? this.user()?.username));
  // Resolve the avatar URL, treating empty/broken URLs as "no image" so initials show.
  private failedAvatarUrl = signal<string | null>(null);
  avatarImage = computed(() => {
    const url = this.user()?.profilePictureUrl;
    const valid = url && url.trim() ? url : undefined;
    return valid && valid !== this.failedAvatarUrl() ? valid : undefined;
  });
  // Email/phone are mandatory for ADMIN and organizer roles, optional for ROOT and
  // DISTRIBUTOR (mirrors the backend's ROLES_REQUIRING_EMAIL_PHONE).
  contactRequired = computed(() => {
    const role = this.user()?.role;
    return (
      role === UserRole.ADMIN ||
      role === UserRole.ORGANIZER_ADMIN ||
      role === UserRole.ORGANIZER_USER
    );
  });

  get newPasswordValid(): boolean {
    // form.resetForm() writes null back into the bound model, so guard against it.
    const value = this.passwords.newPassword ?? '';
    return value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
  }

  get passwordsMatch(): boolean {
    return this.passwords.newPassword === this.passwords.confirmPassword;
  }

  ngOnInit(): void {
    const current = this.user();
    if (current) this.populateProfile(current);
  }

  // ── Personal information ───────────────────────────────────────────────────

  onSaveProfile(form: NgForm): void {
    if (form.invalid) return;
    const id = this.user()?.id;
    if (id == null) return;

    // Dirty-fields-only merge patch: omitted = unchanged, '' = clear.
    const request = buildDirtyPatch<UpdateUserRequest>(form, this.profile);
    if (Object.keys(request).length === 0) {
      form.form.markAsPristine();
      return;
    }

    this.savingProfile.set(true);
    this.userService.updateUser(id, request).subscribe({
      next: (updated) => {
        this.savingProfile.set(false);
        this.authService.updateCurrentUser(updated);
        this.populateProfile(updated);
        form.form.markAsPristine();
        this.toast.success('Profile updated');
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
      next: () => {
        this.savingPassword.set(false);
        this.passwords = { newPassword: '', confirmPassword: '' };
        form.resetForm();
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

  openImagePreview(): void {
    if (this.avatarImage()) this.imagePreviewVisible.set(true);
  }

  onAvatarInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.cropFile.set(file);
      this.cropVisible.set(true);
    }
    input.value = '';
  }

  onAvatarCropped(file: File): void {
    this.onAvatarSelected(file);
  }

  onAvatarImageError(): void {
    this.failedAvatarUrl.set(this.user()?.profilePictureUrl ?? null);
  }

  onAvatarSelected(file: File): void {
    const id = this.user()?.id;
    if (id == null) return;
    this.avatarPending.set(true);
    this.imageUploadService.replaceUserAvatar(id, file).subscribe({
      next: (user) => this.afterAvatarChange(user.profilePictureUrl, 'Profile picture updated'),
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
      next: (user) => this.afterAvatarChange(user.profilePictureUrl, 'Profile picture removed'),
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

  private afterAvatarChange(url: string | undefined, message: string): void {
    this.avatarPending.set(false);
    this.authService.updateCurrentUser({ profilePictureUrl: url });
    this.toast.success(message);
  }
}
