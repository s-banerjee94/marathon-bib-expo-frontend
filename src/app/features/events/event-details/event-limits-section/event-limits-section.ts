import { Component, inject, input, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { EventLimit, UpdateEventLimitRequest } from '../../../../core/models/event-limit.model';
import { EventService } from '../../../../core/services/event.service';
import { ParticipantService } from '../../../../core/services/participant.service';
import { SmsTemplateService } from '../../../../core/services/sms-template.service';
import { SmsCampaignService } from '../../../../core/services/sms-campaign.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/user.model';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { buildDirtyPatch } from '../../../../shared/utils/form.utils';
import { EventDetailsState } from '../event-details-state.service';

type LimitKey = keyof UpdateEventLimitRequest;
type UsageMap = Record<LimitKey, number | null>;

interface LimitMeta {
  key: LimitKey;
  label: string;
  icon: string;
  description: string;
  // Categories are capped per-race, so its usage is the busiest race ("max N").
  perRace?: boolean;
}

// The eight caps, in the order they appear on screen.
const LIMIT_FIELDS: readonly LimitMeta[] = [
  {
    key: 'maxParticipants',
    label: 'Participants',
    icon: 'pi-users',
    description: 'Registered participants',
  },
  { key: 'maxRaces', label: 'Races', icon: 'pi-flag', description: 'Races in this event' },
  {
    key: 'maxCategoriesPerRace',
    label: 'Categories per Race',
    icon: 'pi-tags',
    description: 'Categories within one race',
    perRace: true,
  },
  {
    key: 'maxGoodies',
    label: 'Goodie Types',
    icon: 'pi-gift',
    description: 'Distinct goodie types',
  },
  {
    key: 'maxSmsTemplates',
    label: 'SMS Templates',
    icon: 'pi-envelope',
    description: 'Saved SMS templates',
  },
  { key: 'maxSmsCampaigns', label: 'SMS Campaigns', icon: 'pi-send', description: 'SMS campaigns' },
  {
    key: 'maxImports',
    label: 'Full Imports',
    icon: 'pi-upload',
    description: 'Full participant imports',
  },
  {
    key: 'maxAddOns',
    label: 'Add-on Imports',
    icon: 'pi-plus-circle',
    description: 'Walk-in / add-on imports',
  },
];

@Component({
  selector: 'app-event-limits-section',
  imports: [
    DecimalPipe,
    FormsModule,
    ButtonModule,
    CardModule,
    InputNumberModule,
    ProgressBarModule,
    SkeletonModule,
    TagModule,
  ],
  templateUrl: './event-limits-section.html',
  styleUrl: './event-limits-section.css',
})
export class EventLimitsSection implements OnInit {
  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  private eventService = inject(EventService);
  private participantService = inject(ParticipantService);
  private smsTemplateService = inject(SmsTemplateService);
  private smsCampaignService = inject(SmsCampaignService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private authService = inject(AuthService);
  private state = inject(EventDetailsState);

  protected readonly fields = LIMIT_FIELDS;
  protected readonly buttonSize = BUTTON_SIZE;
  protected readonly inputSize = FORM_INPUT_SIZE;

  // Only ROOT/ADMIN may edit; everyone else who can reach the tab sees it read-only.
  protected readonly canManage = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  // Set when the backend forbids reading limits (currently ROOT/ADMIN-only on GET).
  protected readonly forbidden = signal(false);

  // Current usage per cap. null = not available (backend exposes no usage for
  // full/add-on imports), which renders the card without a progress bar.
  protected readonly usage = signal<UsageMap>(this.emptyUsage());

  // The values last loaded from the backend; the edit form mutates a copy.
  private baseline: EventLimit | null = null;
  protected formData: UsageMap = this.emptyForm();

  ngOnInit(): void {
    this.loadLimits();
  }

  loadLimits(): void {
    this.isLoading.set(true);
    this.forbidden.set(false);
    this.eventService
      .getEventLimits(this.eventId())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (limits) => {
          this.baseline = limits;
          this.formData = this.toForm(limits);
          this.loadUsage();
        },
        error: (error: unknown) => {
          // A 403 here means the caller's role can't read limits — degrade to a
          // friendly notice rather than a scary toast.
          if (error instanceof HttpErrorResponse && error.status === 403) {
            this.forbidden.set(true);
            return;
          }
          this.errorHandler.showError(error, 'Failed to load resource limits');
        },
      });
  }

  // Usage isn't exposed in one place, so fan out to the per-resource endpoints.
  // Each source fails soft (catchError → null) so one outage just hides one bar.
  private loadUsage(): void {
    const id = this.eventId();
    forkJoin({
      participants: this.participantService
        .getParticipantCount(id)
        .pipe(catchError(() => of(null))),
      races: this.eventService.getRaces(id).pipe(catchError(() => of(null))),
      templates: this.smsTemplateService
        .getSmsTemplatesByEvent(id)
        .pipe(catchError(() => of(null))),
      campaigns: this.smsCampaignService.getCampaignsByEvent(id).pipe(catchError(() => of(null))),
    }).subscribe(({ participants, races, templates, campaigns }) => {
      this.usage.set({
        maxParticipants: participants?.count ?? null,
        maxRaces: races?.length ?? null,
        maxCategoriesPerRace: races?.length
          ? Math.max(0, ...races.map((r) => r.categoryCount ?? 0))
          : null,
        maxGoodies: this.state.goodiesArray().length,
        maxSmsTemplates: templates?.length ?? null,
        maxSmsCampaigns: campaigns?.length ?? null,
        // No backend source distinguishes full vs add-on import counts yet.
        maxImports: null,
        maxAddOns: null,
      });
    });
  }

  // ----- usage helpers (read in the template) -----

  // Scoped progressbar fill colors by state (stable refs so dt isn't re-applied
  // every change-detection). `ok` returns undefined → keeps the default primary.
  private static readonly DT_NEAR = { value: { background: 'var(--p-yellow-500)' } };
  private static readonly DT_OVER = { value: { background: 'var(--p-red-500)' } };

  protected barDt(key: LimitKey): object | undefined {
    const state = this.usageState(key);
    if (state === 'near') return EventLimitsSection.DT_NEAR;
    if (state === 'over') return EventLimitsSection.DT_OVER;
    return undefined;
  }

  protected usagePercent(key: LimitKey): number | null {
    const used = this.usage()[key];
    const cap = this.formData[key];
    if (used === null || cap === null || cap <= 0) return null;
    return Math.min(100, Math.round((used / cap) * 100));
  }

  protected usageState(key: LimitKey): 'over' | 'near' | 'ok' | null {
    const used = this.usage()[key];
    const cap = this.formData[key];
    if (used === null || cap === null || cap <= 0) return null;
    if (used > cap) return 'over';
    if (used / cap >= 0.9) return 'near';
    return 'ok';
  }

  protected usageCaption(meta: LimitMeta): string | null {
    const used = this.usage()[meta.key];
    const cap = this.formData[meta.key];
    if (used === null || cap === null) return null;
    const prefix = meta.perRace ? 'max ' : '';
    return `${prefix}${used.toLocaleString()} of ${cap.toLocaleString()} used`;
  }

  onSave(form: NgForm): void {
    if (!form.valid || !this.canManage) return;

    const patch = buildDirtyPatch<UpdateEventLimitRequest>(form, this.formData);
    if (!Object.keys(patch).length) {
      form.form.markAsPristine();
      return;
    }

    this.isSaving.set(true);
    this.eventService
      .updateEventLimits(this.eventId(), patch)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (limits) => {
          this.baseline = limits;
          this.formData = this.toForm(limits);
          form.form.markAsPristine();
          this.toast.success('Resource limits updated successfully');
        },
        error: (error: unknown) => this.errorHandler.showError(error, 'Failed to update limits'),
      });
  }

  onDiscard(form: NgForm): void {
    if (this.baseline) this.formData = this.toForm(this.baseline);
    form.form.markAsPristine();
  }

  private toForm(limits: EventLimit): UsageMap {
    return {
      maxParticipants: limits.maxParticipants,
      maxRaces: limits.maxRaces,
      maxCategoriesPerRace: limits.maxCategoriesPerRace,
      maxGoodies: limits.maxGoodies,
      maxSmsTemplates: limits.maxSmsTemplates,
      maxSmsCampaigns: limits.maxSmsCampaigns,
      maxImports: limits.maxImports,
      maxAddOns: limits.maxAddOns,
    };
  }

  private emptyForm(): UsageMap {
    return this.emptyUsage();
  }

  private emptyUsage(): UsageMap {
    return {
      maxParticipants: null,
      maxRaces: null,
      maxCategoriesPerRace: null,
      maxGoodies: null,
      maxSmsTemplates: null,
      maxSmsCampaigns: null,
      maxImports: null,
      maxAddOns: null,
    };
  }
}
