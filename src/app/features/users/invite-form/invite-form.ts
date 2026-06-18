import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  ROLE_AVAILABILITY,
  ROLE_LABELS,
  RoleOption,
  UserRole,
} from '../../../core/models/user.model';
import {
  CreateInvitationRequest,
  DeliveryChannel,
  DeliveryResult,
} from '../../../core/models/invitation.model';
import { Organization } from '../../../core/models/organization.model';
import { EventStatus } from '../../../core/models/event.model';
import { InvitationService } from '../../../core/services/invitation.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { roleRequiresEvent, roleRequiresOrganization } from '../user-form/user-form.utils';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { EventSelector } from '../../../layout/event-selector/event-selector';

/**
 * Issue-a-user-invite dialog (opened from the Users list "Create" popover →
 * "Invite link"). The issuer fixes the new user's role and organization; the
 * backend returns a one-time link the invitee opens to fill in their own
 * account details. Single view: a read-only link field (with copy / native-share)
 * sits in place and is populated once a link is generated; selecting delivery
 * channels also has the backend send it. ROLE_AVAILABILITY already encodes the
 * exact set of roles each issuer may invite, matching the backend.
 */
@Component({
  selector: 'app-invite-form',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    RadioButtonModule,
    SelectButtonModule,
    FloatLabelModule,
    MessageModule,
    InputTextModule,
    OrganizationSelector,
    EventSelector,
  ],
  templateUrl: './invite-form.html',
  styleUrl: './invite-form.css',
})
export class InviteForm implements OnInit {
  private dialogRef = inject(DynamicDialogRef, { optional: true });
  private invitationService = inject(InvitationService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);

  @ViewChild(EventSelector) private eventSelector?: EventSelector;

  readonly inputSize = FORM_INPUT_SIZE;
  readonly roleLabels = ROLE_LABELS;
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  // Hide completed/cancelled events from the distributor event picker.
  readonly excludedEventStatuses = [EventStatus.COMPLETED, EventStatus.CANCELLED];
  shouldShowError = shouldShowError;

  // Channels the issuer can have the backend deliver the link on (EMAIL is
  // delivery-only and never offered here). Display metadata is keyed by channel.
  readonly channelOptions: { label: string; value: DeliveryChannel; icon: string }[] = [
    { label: 'WhatsApp', value: 'WHATSAPP', icon: 'pi pi-whatsapp' },
    { label: 'SMS', value: 'SMS', icon: 'pi pi-comment' },
  ];
  readonly channelMeta: Record<string, { label: string; icon: string }> = {
    WHATSAPP: { label: 'WhatsApp', icon: 'pi pi-whatsapp' },
    SMS: { label: 'SMS', icon: 'pi pi-comment' },
    EMAIL: { label: 'Email', icon: 'pi pi-envelope' },
  };

  currentUserRole = signal<UserRole | null>(null);
  availableRoles = signal<RoleOption[]>([]);
  selectedRole = signal<UserRole | null>(null);
  organizationId = signal<number | undefined>(undefined);
  organizationName = signal<string | null>(null);
  // Event a distributor invite is bound to (required for DISTRIBUTOR only).
  eventId = signal<number | undefined>(undefined);
  attemptedIssue = signal(false);

  // Delivery: empty = manual (just return the URL). Selecting a channel reveals
  // the recipient-phone field and, with a valid number, has the backend send it.
  selectedChannels = signal<DeliveryChannel[]>([]);
  recipientPhone = signal('');
  channelsSelected = computed(() => this.selectedChannels().length > 0);
  // Set on a Send attempt so the phone error shows even though Send isn't a form submit.
  attemptedSend = signal(false);

  isSubmitting = signal(false);
  // The issued link; populated into the always-present read-only field.
  inviteUrl = signal<string | null>(null);
  // Per-channel delivery outcome from the response (empty for manual invites).
  deliveries = signal<DeliveryResult[]>([]);

  ngOnInit(): void {
    const role = this.authService.getCurrentRole();
    this.currentUserRole.set(role);
    const roles = role ? (ROLE_AVAILABILITY[role] ?? []) : [];
    this.availableRoles.set(roles);
    this.selectedRole.set(roles[0]?.value ?? null);
    this.onRoleSelected();
  }

  onRoleChange(role: UserRole): void {
    this.selectedRole.set(role);
    this.onRoleSelected();
  }

  onRoleSelected(): void {
    const role = this.selectedRole();
    // Reset org + event context whenever the role changes.
    this.organizationId.set(undefined);
    this.organizationName.set(null);
    this.eventId.set(undefined);
    this.eventSelector?.reset();

    // Org-scoped issuers can only invite into their own organization.
    const currentRole = this.currentUserRole();
    if (
      role &&
      (currentRole === UserRole.ORGANIZER_ADMIN || currentRole === UserRole.ORGANIZER_USER)
    ) {
      const me = this.authService.currentUser();
      this.organizationId.set(me?.organizationId);
      this.organizationName.set(me?.organizationName ?? null);
    }
  }

  // Only ROOT/ADMIN pick an organization, and only when the role needs one.
  showOrganizationDropdown(): boolean {
    const currentRole = this.currentUserRole();
    if (currentRole === UserRole.ROOT || currentRole === UserRole.ADMIN) {
      return roleRequiresOrganization(this.selectedRole());
    }
    return false;
  }

  // Distributors are bound to one event, so the picker shows for that role only.
  showEventPicker(): boolean {
    return roleRequiresEvent(this.selectedRole());
  }

  onOrganizationSelected(org: Organization): void {
    this.organizationId.set(org.id);
    this.organizationName.set(org.organizerName);
    // Org changed — drop any event picked under the previous org.
    this.eventId.set(undefined);
    this.eventSelector?.reset();
  }

  onOrganizationCleared(): void {
    this.organizationId.set(undefined);
    this.organizationName.set(null);
    this.eventId.set(undefined);
    this.eventSelector?.reset();
  }

  // "Generate link" — just mint a shareable link, no delivery.
  onGenerate(): void {
    const request = this.baseRequest();
    if (request) this.issue(request);
  }

  // "Send" — mint the link and have the backend deliver it to the entered number
  // over the selected channels.
  onSend(): void {
    const request = this.baseRequest();
    if (!request) return;

    const channels = this.selectedChannels();
    if (channels.length === 0) {
      this.toast.error('Select WhatsApp or SMS to send the link.');
      return;
    }

    this.attemptedSend.set(true);
    const phone = this.recipientPhone().trim();
    if (!/^\d{10}$/.test(phone)) return; // inline phone error is now shown

    request.deliveryChannels = channels;
    request.recipientPhone = phone;
    this.issue(request);
  }

  // Role/org payload shared by generate and send; null when the org is required
  // but missing (the caller stops).
  private baseRequest(): CreateInvitationRequest | null {
    const role = this.selectedRole();
    if (!role) return null;
    this.attemptedIssue.set(true);
    if (roleRequiresOrganization(role) && !this.organizationId()) {
      this.toast.error('Organization is required. Please select an organization.');
      return null;
    }
    if (roleRequiresEvent(role) && !this.eventId()) {
      this.toast.error('Event is required. Please select an event for the distributor.');
      return null;
    }
    const request: CreateInvitationRequest = { role };
    if (roleRequiresOrganization(role)) {
      request.organizationId = this.organizationId();
    }
    if (roleRequiresEvent(role)) {
      request.eventId = this.eventId();
    }
    return request;
  }

  private issue(request: CreateInvitationRequest): void {
    this.isSubmitting.set(true);
    this.invitationService.createInvitation(request).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.inviteUrl.set(response.inviteUrl);
        this.deliveries.set(response.deliveries ?? []);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  async copyLink(): Promise<void> {
    const url = this.inviteUrl();
    if (!url) return;
    const copied = await this.writeToClipboard(url);
    if (copied) {
      this.toast.success('Invite link copied to clipboard');
    } else {
      this.toast.error('Could not copy the link');
    }
  }

  // navigator.clipboard only exists in secure contexts (https/localhost), so on a
  // phone hitting the dev server over plain-http LAN it's undefined — fall back to
  // the legacy execCommand path via a temporary textarea.
  private async writeToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Permission/context failure — try the legacy path below.
      }
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  async shareLink(): Promise<void> {
    const url = this.inviteUrl();
    if (!url) return;
    try {
      await navigator.share({
        title: 'User invite',
        text: 'Use this link to create your account',
        url,
      });
    } catch (err) {
      // The user dismissed the share sheet — don't fall back to copy.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      await this.copyLink();
    }
  }

  close(): void {
    this.dialogRef?.close();
  }
}
