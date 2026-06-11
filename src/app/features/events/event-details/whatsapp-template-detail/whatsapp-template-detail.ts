import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { WhatsAppTemplate } from '../../../../core/models/whatsapp-template.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { PLACEHOLDER_MAP } from '../../../../shared/constants/sms-template-placeholders.constant';
import { parseBodySegments } from '../../../../shared/utils/template-body.utils';

@Component({
  selector: 'app-whatsapp-template-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DividerModule, ButtonModule, TagModule, DefaultValuePipe],
  templateUrl: './whatsapp-template-detail.html',
})
export class WhatsappTemplateDetail {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  template = signal<WhatsAppTemplate | null>(this.config.data?.template ?? null);

  scopeLabel = computed(() =>
    this.template()?.senderScope === 'ORGANIZATION'
      ? "Organization's own account"
      : 'Default (application account)',
  );

  // Body split into text + {{n}} marker segments so each marker can be shown
  // next to the variable (bodyVariables[n-1]) that fills it.
  bodySegments = computed(() => parseBodySegments(this.template()?.body ?? ''));

  variableAt(slot: number): string | undefined {
    return this.template()?.bodyVariables?.[slot - 1];
  }

  variableLabel(expression: string): string {
    const field = expression.replace(/^#\{|\}$/g, '');
    return PLACEHOLDER_MAP[field] ?? expression;
  }

  onClose(): void {
    this.ref.close();
  }
}
