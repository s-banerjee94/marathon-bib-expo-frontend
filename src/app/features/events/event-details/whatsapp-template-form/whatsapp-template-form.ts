import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import {
  CreateWhatsAppTemplateRequest,
  UpdateWhatsAppTemplateRequest,
  WhatsAppTemplate,
} from '../../../../core/models/whatsapp-template.model';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { buildDirtyPatch } from '../../../../shared/utils/form.utils';
import { parseBodySegments } from '../../../../shared/utils/template-body.utils';
import { PlaceholderVariablePicker } from '../../../../shared/components/placeholder-variable-picker/placeholder-variable-picker';

const MAX_BODY_LENGTH = 1024;

@Component({
  selector: 'app-whatsapp-template-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
    TagModule,
    PlaceholderVariablePicker,
  ],
  templateUrl: './whatsapp-template-form.html',
  styleUrl: './whatsapp-template-form.css',
})
export class WhatsappTemplateForm implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private whatsAppService = inject(WhatsAppService);
  private errorHandler = inject(ErrorHandlerService);

  isEditMode = signal(false);
  isSubmitting = signal(false);
  bodyVariables = signal<string[]>([]);
  bodyValue = signal('');

  private eventId!: number;
  private templateId: number | null = null;
  private originalBodyVariables: string[] = [];

  readonly inputSize = FORM_INPUT_SIZE;
  readonly maxBodyLength = MAX_BODY_LENGTH;

  // Body split into text + {{n}} marker segments so the preview can show each
  // marker next to the variable (bodyVariables[n-1]) that fills it.
  bodySegments = computed(() => parseBodySegments(this.bodyValue()));

  markerCount = computed(() => this.bodySegments().filter((s) => s.type === 'marker').length);

  // The body uses a {{n}} marker with no variable defined at slot n.
  hasUnmappedMarker = computed(() =>
    this.bodySegments().some((s) => s.type === 'marker' && !this.bodyVariables()[s.index - 1]),
  );

  formData: {
    name: string;
    contentSid: string;
    body: string;
    note: string;
  } = {
    name: '',
    contentSid: '',
    body: '',
    note: '',
  };

  ngOnInit(): void {
    const data = this.config.data as { whatsAppTemplate?: WhatsAppTemplate; eventId: number };
    const t = data?.whatsAppTemplate ?? null;
    this.eventId = data.eventId;
    this.templateId = t?.id ?? null;
    this.isEditMode.set(!!t);
    this.formData = {
      name: t?.name ?? '',
      contentSid: t?.contentSid ?? '',
      body: t?.body ?? '',
      note: t?.note ?? '',
    };
    this.bodyValue.set(this.formData.body);
    this.originalBodyVariables = [...(t?.bodyVariables ?? [])];
    this.bodyVariables.set([...this.originalBodyVariables]);
  }

  onBodyChange(value: string): void {
    this.bodyValue.set(value ?? '');
  }

  variableAt(slot: number): string | undefined {
    return this.bodyVariables()[slot - 1];
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    const variablesChanged = !this.sameVariables(this.bodyVariables(), this.originalBodyVariables);

    if (this.isEditMode()) {
      const patch = buildDirtyPatch<UpdateWhatsAppTemplateRequest>(form, this.formData);
      if (variablesChanged) patch.bodyVariables = this.bodyVariables();
      if (!Object.keys(patch).length) {
        this.ref.close();
        return;
      }
      this.submit(this.whatsAppService.updateTemplate(this.eventId, this.templateId!, patch));
      return;
    }

    const payload: CreateWhatsAppTemplateRequest = {
      ...this.formData,
      bodyVariables: this.bodyVariables(),
    };
    this.submit(this.whatsAppService.createTemplate(this.eventId, payload));
  }

  private submit(request$: ReturnType<WhatsAppService['createTemplate']>): void {
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
          this.isEditMode()
            ? 'Failed to update WhatsApp template'
            : 'Failed to create WhatsApp template',
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
}
