import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogService } from 'primeng/dynamicdialog';
import { SystemMessagingService } from '../../../core/services/system-messaging.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import {
  MessagePurpose,
  MessagingChannel,
  SystemMessageTemplateResponse,
} from '../../../core/models/system-messaging.model';
import { MESSAGE_PURPOSES, PurposeMeta } from '../system-messaging.constants';
import { TemplateEditor } from '../template-editor/template-editor';
import { injectIsMobile } from '../../../shared/utils/responsive.utils';

interface PurposeCard extends PurposeMeta {
  template?: SystemMessageTemplateResponse;
}

@Component({
  selector: 'app-channel-templates',
  imports: [CardModule, TagModule, SkeletonModule],
  providers: [DialogService],
  templateUrl: './channel-templates.html',
  styleUrl: './channel-templates.css',
})
export class ChannelTemplates {
  private service = inject(SystemMessagingService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private isMobile = injectIsMobile();

  readonly channel = input.required<MessagingChannel>();

  protected readonly purposes = MESSAGE_PURPOSES;
  protected readonly loading = signal(true);
  private readonly templates = signal<SystemMessageTemplateResponse[]>([]);

  protected readonly cards = computed<PurposeCard[]>(() =>
    this.purposes.map((purpose) => ({
      ...purpose,
      template: this.templates().find((t) => t.purpose === purpose.value),
    })),
  );

  constructor() {
    effect(() => this.load(this.channel()));
  }

  private load(channel: MessagingChannel): void {
    this.loading.set(true);
    this.templates.set([]);
    this.service.listTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates.filter((t) => t.channel === channel));
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  protected openTemplate(purpose: MessagePurpose): void {
    if (this.isMobile()) {
      this.router.navigate(['/system-messaging', this.channel(), 'templates', purpose]);
      return;
    }

    const ref = this.dialogService.open(TemplateEditor, {
      header: undefined,
      modal: true,
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      style: { width: '640px', 'max-width': '95vw' },
      contentStyle: { padding: '0' },
      data: { purpose, channel: this.channel() },
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result?.saved) {
          this.load(this.channel());
        }
      });
    }
  }

  protected purposeIcon(purpose: MessagePurpose): string {
    const icons: Record<MessagePurpose, string> = {
      INVITE: 'pi pi-envelope',
      PASSWORD_RESET: 'pi pi-key',
      OTP: 'pi pi-shield',
    };
    return icons[purpose];
  }

  protected preview(template?: SystemMessageTemplateResponse): string {
    if (!template) return 'Not configured';
    const text = (template.body || template.variables || '').replace(/\s+/g, ' ').trim();
    return text.length ? text : 'No content yet';
  }
}
