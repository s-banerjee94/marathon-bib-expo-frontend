import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastMessageOptions } from 'primeng/api';
import { ToastCloseEvent, ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ACTION_TOAST_KEY, ToastAction, ToastService } from '../../core/services/toast.service';

/**
 * The app's toast rendering surface: the default <p-toast> plus a keyed headless
 * <p-toast> for interactive "action" toasts. No MessageService provider here — it
 * must resolve to the root instance ToastService writes to.
 */
@Component({
  selector: 'app-toast-outlet',
  imports: [ToastModule, ButtonModule],
  templateUrl: './toast-outlet.html',
  styleUrl: './toast-outlet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastOutlet {
  private readonly toast = inject(ToastService);
  protected readonly actionKey = ACTION_TOAST_KEY;

  protected actionsOf(message: ToastMessageOptions): ToastAction[] {
    return (message.data?.actions as ToastAction[] | undefined) ?? [];
  }

  protected iconOf(message: ToastMessageOptions): string {
    switch (message.data?.severity) {
      case 'success':
        return 'pi pi-check-circle';
      case 'warn':
        return 'pi pi-exclamation-triangle';
      case 'error':
        return 'pi pi-times-circle';
      default:
        return 'pi pi-info-circle';
    }
  }

  protected runAction(action: ToastAction, closeFn: (event: Event) => void, event: Event): void {
    action.run();
    if (action.closeAfter !== false) closeFn(event);
  }

  protected onClose(event: ToastCloseEvent): void {
    this.toast.release(event.message?.data?.['dedupeKey']);
  }
}
