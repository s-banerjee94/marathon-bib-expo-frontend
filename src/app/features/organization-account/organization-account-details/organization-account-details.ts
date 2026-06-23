import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { OrganizationService } from '../../../core/services/organization.service';
import { ImageUploadService } from '../../../core/services/image-upload.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import {
  Organization,
  SubscriptionTier,
  UpdateOrganizationRequest,
} from '../../../core/models/organization.model';
import { ROLE_LABELS, UserRole } from '../../../core/models/user.model';
import { buildDirtyPatch, shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { SUBSCRIPTION_TIER_OPTIONS } from '../../../shared/constants/subscription.constant';
import {
  getSubscriptionStatusLabel,
  getSubscriptionStatusSeverity,
} from '../../../shared/utils/subscription-status.utils';
import { OrganizationAccountState } from '../organization-account-state.service';

/**
 * Account tab of the organization page — the editable details, logo, and (for
 * ROOT/ADMIN) governance form. Reads the organization from the shell's
 * `OrganizationAccountState` and writes updates back to it so the other tabs see
 * fresh data.
 */
@Component({
  selector: 'app-organization-account-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    CardModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    MessageModule,
    ProgressBarModule,
    SelectModule,
    InputNumberModule,
    ImageUpload,
    DefaultValuePipe,
  ],
  templateUrl: './organization-account-details.html',
  styleUrl: './organization-account-details.css',
})
export class OrganizationAccountDetails implements OnInit {
  private organizationService = inject(OrganizationService);
  private imageUploadService = inject(ImageUploadService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private authService = inject(AuthService);
  private state = inject(OrganizationAccountState);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly subscriptionTiers = SUBSCRIPTION_TIER_OPTIONS;
  shouldShowError = shouldShowError;

  readonly organization = this.state.organization;

  // ROOT/ADMIN may edit governance fields (tier, billing email, quotas); an
  // ORGANIZER_ADMIN editing their own org sees them read-only.
  readonly canEditGovernance = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

  savingDetails = signal(false);
  logoPending = signal(false);

  // Editable form models (kept separate from the loaded org so Reset works).
  details = {
    organizerName: '',
    email: '',
    phoneNumber: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    taxId: '',
    registrationNumber: '',
  };
  governance = {
    subscriptionTier: undefined as SubscriptionTier | undefined,
    billingEmail: '',
    maxAdmins: null as number | null,
    maxOrganizerUsers: null as number | null,
    maxDistributors: null as number | null,
  };

  tierLabel = computed(() => {
    const tier = this.organization()?.subscriptionTier;
    return this.subscriptionTiers.find((o) => o.value === tier)?.label ?? tier ?? '--';
  });

  protected readonly statusSeverity = getSubscriptionStatusSeverity;
  protected readonly statusLabel = getSubscriptionStatusLabel;

  // Read-only usage rows for the quota card: label, "used / max" text, and a
  // fill percentage for the progress bar (0 when the quota is unlimited).
  quotaRows = computed(() => {
    const q = this.organization()?.userQuota;
    const rows = [
      {
        label: ROLE_LABELS[UserRole.ORGANIZER_ADMIN],
        used: q?.admins?.used ?? 0,
        max: q?.admins?.max,
      },
      {
        label: ROLE_LABELS[UserRole.ORGANIZER_USER],
        used: q?.organizerUsers?.used ?? 0,
        max: q?.organizerUsers?.max,
      },
      {
        label: ROLE_LABELS[UserRole.DISTRIBUTOR],
        used: q?.distributors?.used ?? 0,
        max: q?.distributors?.max,
      },
    ];
    return rows.map((r) => ({
      label: r.label,
      display: `${r.used} / ${r.max ?? '∞'}`,
      percent: r.max && r.max > 0 ? Math.min(100, Math.round((r.used / r.max) * 100)) : 0,
    }));
  });

  ngOnInit(): void {
    const org = this.organization();
    if (org) this.populateDetails(org);
  }

  // ── Details ─────────────────────────────────────────────────────────────────

  onSaveDetails(form: NgForm): void {
    if (form.invalid) return;
    const id = this.organization()?.id;
    if (id == null) return;

    // Dirty-fields-only merge patch: omitted = unchanged, '' = clear.
    const request = buildDirtyPatch<UpdateOrganizationRequest>(form, this.details);

    if (this.canEditGovernance) {
      if (form.controls['subscriptionTier']?.dirty) {
        request.subscriptionTier = this.governance.subscriptionTier;
      }
      if (form.controls['billingEmail']?.dirty) {
        request.billingEmail = this.governance.billingEmail;
      }
      const quotaDirty = ['maxAdmins', 'maxOrganizerUsers', 'maxDistributors'].some(
        (key) => form.controls[key]?.dirty,
      );
      // The quota object travels whole — the backend applies all three caps together.
      if (quotaDirty) {
        request.userQuota = {
          admins: { max: this.governance.maxAdmins },
          organizerUsers: { max: this.governance.maxOrganizerUsers },
          distributors: { max: this.governance.maxDistributors },
        };
      }
    }

    if (Object.keys(request).length === 0) {
      form.form.markAsPristine();
      return;
    }

    this.savingDetails.set(true);
    this.organizationService.updateOrganization(id, request).subscribe({
      next: (updated) => {
        this.savingDetails.set(false);
        this.state.setOrganization(updated);
        this.populateDetails(updated);
        form.form.markAsPristine();
        this.toast.success('Organization updated');
      },
      error: (error) => {
        this.savingDetails.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  resetDetails(form: NgForm): void {
    const current = this.organization();
    if (current) this.populateDetails(current);
    form.form.markAsPristine();
  }

  // ── Logo ──────────────────────────────────────────────────────────────────

  onLogoSelected(file: File): void {
    const id = this.organization()?.id;
    if (id == null) return;
    this.logoPending.set(true);
    this.imageUploadService.replaceOrganizationLogo(id, file).subscribe({
      next: (org) => this.afterLogoChange(org.logoUrl, 'Logo updated'),
      error: (error) => {
        this.logoPending.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onLogoRemove(): void {
    const id = this.organization()?.id;
    if (id == null) return;
    this.logoPending.set(true);
    this.imageUploadService.removeOrganizationLogo(id).subscribe({
      next: (org) => this.afterLogoChange(org.logoUrl, 'Logo removed'),
      error: (error) => {
        this.logoPending.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  private afterLogoChange(logoUrl: string | undefined, message: string): void {
    this.logoPending.set(false);
    const current = this.organization();
    if (current) this.state.setOrganization({ ...current, logoUrl });
    this.toast.success(message);
  }

  private populateDetails(org: Organization): void {
    this.details = {
      organizerName: org.organizerName ?? '',
      email: org.email ?? '',
      phoneNumber: org.phoneNumber ?? '',
      website: org.website ?? '',
      addressLine1: org.addressLine1 ?? '',
      addressLine2: org.addressLine2 ?? '',
      city: org.city ?? '',
      stateProvince: org.stateProvince ?? '',
      postalCode: org.postalCode ?? '',
      country: org.country ?? '',
      taxId: org.taxId ?? '',
      registrationNumber: org.registrationNumber ?? '',
    };
    this.governance = {
      subscriptionTier: org.subscriptionTier,
      billingEmail: org.billingEmail ?? '',
      maxAdmins: org.userQuota?.admins?.max ?? null,
      maxOrganizerUsers: org.userQuota?.organizerUsers?.max ?? null,
      maxDistributors: org.userQuota?.distributors?.max ?? null,
    };
  }
}
