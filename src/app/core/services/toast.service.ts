import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

type ToastMessage = Parameters<MessageService['add']>[0];

/**
 * Single chokepoint for displaying PrimeNG toasts.
 *
 * Every component, service, and util in the app must go through this service
 * for toast notifications — direct use of MessageService.add() is forbidden.
 * There is exactly one <p-toast /> outlet in app.html, bound to one root-scoped
 * MessageService instance.
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly messageService = inject(MessageService);

  success(detail: string, summary: string = 'Success'): void {
    this.messageService.add({ severity: 'success', summary, detail, life: 3000 });
  }

  error(detail: string, summary: string = 'Error'): void {
    this.messageService.add({ severity: 'error', summary, detail, life: 5000 });
  }

  info(detail: string, summary: string = 'Info'): void {
    this.messageService.add({ severity: 'info', summary, detail, life: 3000 });
  }

  warn(detail: string, summary: string = 'Warning'): void {
    this.messageService.add({ severity: 'warn', summary, detail, life: 4000 });
  }

  /** Escape hatch for passing through a fully-formed Message. */
  show(message: ToastMessage): void {
    this.messageService.add(message);
  }

  clear(key?: string): void {
    this.messageService.clear(key);
  }
}
