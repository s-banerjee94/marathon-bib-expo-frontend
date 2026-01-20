import { NgModel } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { ErrorHandlerService } from '../../core/services/error-handler.service';

/**
 * Check if form control should show error message
 */
export function shouldShowError(
  control: NgModel | null | undefined,
  formSubmitted: boolean,
): boolean {
  return !!(control && control.invalid && (control.touched || formSubmitted));
}

/**
 * Show success message and navigate to dashboard
 */
export function showSuccessAndNavigate(
  messageService: MessageService,
  message: string,
  router: Router,
  dashboardRoute: string,
): void {
  messageService.add({
    severity: 'success',
    summary: 'Success',
    detail: message,
  });
  router.navigate([dashboardRoute]);
}

/**
 * Initialize error handler with message service
 */
export function initializeErrorHandler(
  errorHandler: ErrorHandlerService,
  messageService: MessageService,
): void {
  errorHandler.setMessageService(messageService);
}
