import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SmsTemplate } from '../../../core/models/sms-template.model';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { FormatDateTimePipe } from '../../../shared/pipes/format-date-time.pipe';

@Component({
  selector: 'app-sms-template-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DividerModule,
    TagModule,
    ButtonModule,
    DefaultValuePipe,
    FormatDateTimePipe,
  ],
  templateUrl: './sms-template-detail.html',
})
export class SmsTemplateDetail {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  template = signal<SmsTemplate | null>(this.config.data?.template ?? null);

  onClose(): void {
    this.ref.close();
  }
}
