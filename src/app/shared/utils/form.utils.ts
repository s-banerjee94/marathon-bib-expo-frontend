import { NgModel } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';

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
  toast: ToastService,
  message: string,
  router: Router,
  dashboardRoute: string,
): void {
  toast.success(message);
  router.navigate([dashboardRoute]);
}
