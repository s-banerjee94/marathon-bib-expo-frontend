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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogService } from 'primeng/dynamicdialog';
import { UserService } from '../../core/services/user.service';
import { ImageUploadService } from '../../core/services/image-upload.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { ROLE_LABELS, UpdateUserRequest, User, UserRole } from '../../core/models/user.model';
import { EventStatus } from '../../core/models/event.model';
import { EventSelector } from '../../layout/event-selector/event-selector';
import { buildDirtyPatch, shouldShowError } from '../../shared/utils/form.utils';
import { getInitials } from '../../shared/utils/initials.util';
import {
  userCanIssueResetLink,
  userCanManage,
  userCanToggleEnabled,
  userCanToggleLocked,
} from '../../shared/utils/user-permissions.utils';
import { roleRequiresEmailPhone } from '../users/user-form/user-form.utils';
import { UserListBus } from '../users/user-list-bus.service';
import { ResetLinkForm } from '../users/reset-link-form/reset-link-form';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';

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
    ProgressSpinnerModule,
    SkeletonModule,
    ToggleSwitchModule,
    DefaultValuePipe,
    EventSelector,
  ],
  providers: [DialogService],
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
  private dialogService = inject(DialogService);

  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;

  user = signal<User | null>(null);
  isLoading = signal(true);
  savingProfile = signal(false);
  avatarPending = signal(false);

  // Account-status switches. The models mirror the loaded user but flip
  // optimistically on toggle and reconcile from the API response (or revert on
  // error). enabled = can sign in; unlocked = NOT locked (accountNonLocked).
  enabledModel = signal(false);
  unlockedModel = signal(false);
  savingEnabled = signal(false);
  savingLocked = signal(false);

  // Green when "good" (enabled / unlocked), red otherwise — scoped design tokens.
  readonly switchStatusDt = {
    background: 'var(--p-red-500)',
    hover: { background: 'var(--p-red-600)' },
    checked: {
      background: 'var(--p-green-500)',
      hover: { background: 'var(--p-green-600)' },
    },
  };

  // Mirrors the backend toggle rules (user-permissions.utils): never yourself,
  // ROOT may target any other user, locking is additionally ROOT/ADMIN-only.
  canToggleEnabled = computed(() => {
    const u = this.user();
    return !!u && userCanToggleEnabled(this.authService.currentUser(), u);
  });
  canToggleLock = computed(() => {
    const u = this.user();
    return !!u && userCanToggleLocked(this.authService.currentUser(), u);
  });
  // Replaces the old direct password reset: issue a one-time link instead.
  canSendResetLink = computed(() => {
    const u = this.user();
    return !!u && userCanIssueResetLink(this.authService.currentUser(), u);
  });

  // Distributor event reassignment (PATCH /users/{id}/event).
  readonly excludedEventStatuses = [EventStatus.COMPLETED, EventStatus.CANCELLED];
  reassignEventId = signal<number | undefined>(undefined);
  savingEvent = signal(false);
  // Shown for distributor targets — they're the only role bound to an event, and
  // anyone who can reach this page for a distributor is allowed to reassign them.
  isDistributor = computed(() => this.user()?.role === UserRole.DISTRIBUTOR);

  // Editable form model (kept separate from the loaded user so Reset works).
  profile = { fullName: '', email: '', phoneNumber: '' };

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
        this.syncAccountStatus(user);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  // ── Account status (enable/disable, lock/unlock) ────────────────────────────

  private syncAccountStatus(user: User): void {
    this.enabledModel.set(user.enabled);
    this.unlockedModel.set(user.accountNonLocked !== false);
  }

  onToggleEnabled(next: boolean): void {
    const u = this.user();
    if (!u || this.savingEnabled()) return;

    this.enabledModel.set(next); // optimistic; reconciled below
    this.savingEnabled.set(true);
    this.userService.toggleEnabled(u.id).subscribe({
      next: (updated) => {
        this.savingEnabled.set(false);
        this.user.set(updated);
        this.enabledModel.set(updated.enabled);
        this.userListBus.publish({ action: 'updated', user: updated });
        this.toast.success(updated.enabled ? 'User enabled' : 'User disabled');
      },
      error: (error) => {
        this.savingEnabled.set(false);
        this.enabledModel.set(u.enabled); // revert
        this.errorHandler.showError(error);
      },
    });
  }

  onToggleLocked(next: boolean): void {
    const u = this.user();
    if (!u || this.savingLocked()) return;

    this.unlockedModel.set(next); // optimistic; reconciled below
    this.savingLocked.set(true);
    this.userService.toggleLocked(u.id).subscribe({
      next: (updated) => {
        this.savingLocked.set(false);
        this.user.set(updated);
        this.unlockedModel.set(updated.accountNonLocked !== false);
        this.userListBus.publish({ action: 'updated', user: updated });
        this.toast.success(updated.accountNonLocked === false ? 'User locked' : 'User unlocked');
      },
      error: (error) => {
        this.savingLocked.set(false);
        this.unlockedModel.set(u.accountNonLocked !== false); // revert
        this.errorHandler.showError(error);
      },
    });
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

  // ── Password reset link ──────────────────────────────────────────────────────

  openResetLinkDialog(): void {
    const user = this.user();
    if (!user) return;
    this.dialogService.open(ResetLinkForm, {
      header: 'Send Reset Link',
      width: '45vw',
      modal: true,
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      breakpoints: { '960px': '95vw', '640px': '100vw' },
      data: { user },
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

  // ── Distributor event reassignment ──────────────────────────────────────────

  // Enabled once a different event is picked from the current assignment.
  canSaveEvent = computed(() => {
    const picked = this.reassignEventId();
    return picked != null && picked !== this.user()?.eventId;
  });

  onReassignEvent(): void {
    const id = this.user()?.id;
    const eventId = this.reassignEventId();
    if (id == null || eventId == null || !this.canSaveEvent()) return;

    this.savingEvent.set(true);
    this.userService.reassignDistributorEvent(id, eventId).subscribe({
      next: (updated) => {
        this.savingEvent.set(false);
        this.reassignEventId.set(undefined);
        this.user.set(updated);
        this.userListBus.publish({ action: 'updated', user: updated });
        this.toast.success('Event reassigned');
      },
      error: (error) => {
        this.savingEvent.set(false);
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
