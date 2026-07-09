import { NgForm, NgModel } from '@angular/forms';
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
 * Builds a partial-update (merge PATCH) payload from a template-driven form:
 * only dirty controls are included, so untouched fields are omitted and left
 * unchanged by the backend. Per the backend contract an empty string means
 * "clear the field" — a cleared text input ('') passes through as the clear
 * signal. Null/undefined values are dropped: non-string fields (numbers,
 * dates, enums) cannot be cleared via PATCH; transform them explicitly via
 * `exclude` when they need a wire format.
 * Control `name` attributes must match the model keys.
 */
export function buildDirtyPatch<R extends object>(
  form: NgForm,
  model: object,
  exclude: ReadonlySet<string> = new Set(),
): R {
  return Object.fromEntries(
    Object.keys(model)
      .filter((key) => !exclude.has(key) && form.controls[key]?.dirty)
      .map((key) => [key, (model as Record<string, unknown>)[key]])
      .filter(([, value]) => value !== null && value !== undefined),
  ) as R;
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
