import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { Popover } from 'primeng/popover';
import {
  SmsTemplate,
  CreateSmsTemplateRequest,
  UpdateSmsTemplateRequest,
} from '../../../../core/models/sms-template.model';
import {
  CampaignProviderSource,
  TemplateMode,
} from '../../../../core/models/campaign-provider-style.model';
import { UserRole } from '../../../../core/models/user.model';
import { SmsTemplateService } from '../../../../core/services/sms-template.service';
import { CampaignProviderStyleService } from '../../../../core/services/campaign-provider-style.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { buildDirtyPatch } from '../../../../shared/utils/form.utils';
import {
  PLACEHOLDER_MAP,
  VALID_PLACEHOLDER_FIELDS,
} from '../../../../shared/constants/sms-template-placeholders.constant';
import { PlaceholderVariablePicker } from '../../../../shared/components/placeholder-variable-picker/placeholder-variable-picker';

interface TemplateSegment {
  type: 'text' | 'var';
  content: string;
  field: string;
  valid: boolean;
}

@Component({
  selector: 'app-sms-template-form',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
    TagModule,
    SkeletonModule,
    Popover,
    PlaceholderVariablePicker,
  ],
  templateUrl: './sms-template-form.html',
  styleUrl: './sms-template-form.css',
})
export class SmsTemplateForm implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private smsTemplateService = inject(SmsTemplateService);
  private styleService = inject(CampaignProviderStyleService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);

  @ViewChild('replacerOp') replacerOp!: Popover;

  isEditMode = signal(false);
  isSubmitting = signal(false);

  // The event's resolved SMS provider decides the template shape, so resolve it on
  // open (never cached — a sender added after this opens must unblock authoring).
  loading = signal(true);
  loadError = signal(false);
  hasProvider = signal<boolean | null>(null);
  providerMode = signal<TemplateMode | null>(null);
  // The mode the template was saved under. On edit this wins over the sender's current
  // mode: if the org switched sender after authoring, following the sender would reshape
  // the form and submit the field the template was not written for, which the server 400s.
  savedRenderMode = signal<TemplateMode | null>(null);
  // PROVIDER_RENDERED → the approved gateway template is rendered by the provider and
  // we only supply positional #{...} variables; CLIENT_RENDERED → we send message text.
  usesVariables = computed(() => this.effectiveMode() === 'PROVIDER_RENDERED');
  effectiveMode = computed(() =>
    this.isEditMode() && this.savedRenderMode() ? this.savedRenderMode() : this.providerMode(),
  );
  // Read-only badge — the enum reads worse than what it means for the author.
  modeLabel = computed(() => (this.usesVariables() ? 'Template variables' : 'Message text'));

  // Which sender the template's registered ids belong to. A template built against one
  // vendor account cannot be sent through the other, so it is shown alongside the shape.
  // Whether it still matches the sender in force is flagged in the list, which already
  // resolves the active sender — edit deliberately makes no style call.
  savedProviderSource = signal<CampaignProviderSource | null>(null);
  providerSourceLabel = computed(() =>
    this.savedProviderSource() === 'ORGANIZATION' ? 'Your own sender' : 'Platform sender',
  );

  private eventId!: number;
  private templateId: number | null = null;
  templateValue = signal('');
  activeReplaceField = signal<string | null>(null);

  bodyVariables = signal<string[]>([]);
  private originalBodyVariables: string[] = [];

  readonly inputSize = FORM_INPUT_SIZE;
  readonly canConfigureProviders = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);
  readonly pickerOptions = Object.entries(PLACEHOLDER_MAP).map(([field, label]) => ({
    field,
    label,
  }));

  formData: {
    name: string;
    smsTemplateId: string;
    senderId: string;
    template: string;
    note: string;
  } = {
    name: '',
    smsTemplateId: '',
    senderId: '',
    template: '',
    note: '',
  };

  segments = computed((): TemplateSegment[] => {
    const text = this.templateValue();
    const result: TemplateSegment[] = [];
    let lastIndex = 0;
    const regex = /#\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
          field: '',
          valid: false,
        });
      }
      const field = match[1];
      result.push({ type: 'var', content: '', field, valid: VALID_PLACEHOLDER_FIELDS.has(field) });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', content: text.slice(lastIndex), field: '', valid: false });
    }
    return result;
  });

  detectedVars = computed(() => {
    const matches = [...this.templateValue().matchAll(/#\{([^}]*)\}/g)];
    return [...new Set(matches.map((m) => m[1]))];
  });

  invalidVars = computed(() => this.detectedVars().filter((f) => !VALID_PLACEHOLDER_FIELDS.has(f)));
  hasInvalidVars = computed(() => this.invalidVars().length > 0);

  ngOnInit(): void {
    const data = this.config.data as { smsTemplate?: SmsTemplate; eventId: number };
    const t = data?.smsTemplate ?? null;
    this.eventId = data.eventId;
    this.templateId = t?.id ?? null;
    this.isEditMode.set(!!t);
    this.formData = {
      name: t?.name ?? '',
      smsTemplateId: t?.smsTemplateId ?? '',
      senderId: t?.senderId ?? '',
      template: t?.template ?? '',
      note: t?.note ?? '',
    };
    this.templateValue.set(this.formData.template);
    this.originalBodyVariables = [...(t?.bodyVariables ?? [])];
    this.bodyVariables.set([...this.originalBodyVariables]);
    this.savedRenderMode.set(t ? (t.renderMode ?? this.deriveRenderMode(t)) : null);
    this.savedProviderSource.set(t?.providerSource ?? null);

    // A new template follows the current sender; an existing one follows its own
    // stamped mode, so the style lookup is a create-only concern.
    if (this.isEditMode() && this.savedRenderMode()) {
      this.loading.set(false);
      return;
    }
    this.loadStyle();
  }

  // Fallback for a template saved before renderMode existed: its content says which
  // shape it was authored for.
  private deriveRenderMode(template: SmsTemplate): TemplateMode | null {
    if (template.bodyVariables?.length) return 'PROVIDER_RENDERED';
    if (template.template?.trim().length) return 'CLIENT_RENDERED';
    return null;
  }

  // A 200 with hasProvider=false → no sender yet (block authoring). A 404 → the event
  // is not visible; treat it as a normal error, not "no provider".
  loadStyle(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.styleService.getStyle(this.eventId, 'SMS').subscribe({
      next: (style) => {
        this.hasProvider.set(style.hasProvider);
        this.providerMode.set(style.templateMode ?? null);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(true);
        this.errorHandler.showError(error);
      },
    });
  }

  goToProviderSettings(): void {
    this.ref.close();
    this.router.navigate(['/campaign-providers']);
  }

  onTemplateChange(value: string): void {
    this.templateValue.set(value ?? '');
  }

  onVarChipClick(field: string, event: MouseEvent): void {
    this.activeReplaceField.set(field);
    this.replacerOp.show(event);
  }

  onPickReplacement(newField: string | null): void {
    if (newField === null) return;
    const oldField = this.activeReplaceField();
    if (oldField === null) return;
    const regex = new RegExp(`#\\{${this.escapeRegex(oldField)}\\}`, 'g');
    const updated = this.formData.template.replace(regex, `#{${newField}}`);
    this.formData.template = updated;
    this.templateValue.set(updated);
    this.replacerOp.hide();
    this.activeReplaceField.set(null);
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;
    // Invalid placeholders only gate the message-text (client-rendered) editor.
    if (!this.usesVariables() && this.hasInvalidVars()) return;

    if (this.isEditMode()) {
      const patch = buildDirtyPatch<UpdateSmsTemplateRequest>(form, this.formData);
      if (
        this.usesVariables() &&
        !this.sameVariables(this.bodyVariables(), this.originalBodyVariables)
      ) {
        patch.bodyVariables = this.bodyVariables();
      }
      if (!Object.keys(patch).length) {
        this.ref.close();
        return;
      }
      this.submit(this.smsTemplateService.updateSmsTemplate(this.eventId, this.templateId!, patch));
      return;
    }

    const base = {
      name: this.formData.name,
      smsTemplateId: this.formData.smsTemplateId,
      senderId: this.formData.senderId,
      note: this.formData.note,
    };
    const payload: CreateSmsTemplateRequest = this.usesVariables()
      ? { ...base, bodyVariables: this.bodyVariables() }
      : { ...base, template: this.formData.template };
    this.submit(this.smsTemplateService.createSmsTemplate(this.eventId, payload));
  }

  private submit(request$: ReturnType<SmsTemplateService['createSmsTemplate']>): void {
    this.isSubmitting.set(true);
    request$.subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        this.ref.close(result);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(
          error,
          this.isEditMode() ? 'Failed to update SMS template' : 'Failed to create SMS template',
        );
      },
    });
  }

  onCancel(): void {
    this.ref.close();
  }

  private sameVariables(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
