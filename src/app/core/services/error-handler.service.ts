import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorOverride, ErrorResponse } from '../models/error.model';
import { ToastService } from './toast.service';

/**
 * Interprets backend error responses and shows them as toasts via ToastService.
 *
 * Backend ErrorResponse shape:
 *   { timestamp, status, error: <title>, message: <detail>, path, validationErrors? }
 *
 * Components inject this and call `showError(httpError)` in their error
 * callbacks. Everything else goes through ToastService directly.
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  private readonly toast = inject(ToastService);

  /**
   * Show a toast for a backend error. Reads the title from `error.error.error`
   * and the detail from `error.error.message`, with sensible fallbacks for
   * non-structured failures (network errors, etc.).
   *
   * @param contextSummary Optional caller context (e.g. "Failed to save user")
   *   that replaces the backend's title.
   */
  showError(
    error: HttpErrorResponse | unknown,
    contextSummary?: string,
    override?: ErrorOverride,
  ): void {
    if (override?.showToast === false) return;

    const { summary, detail } = this.extract(error, override);
    this.toast.error(detail, contextSummary ?? summary);
  }

  /** Build the toast title + body from the error (for callers that need them raw). */
  extract(
    error: HttpErrorResponse | unknown,
    override?: ErrorOverride,
  ): { summary: string; detail: string } {
    if (override?.customMessage) {
      return { summary: 'Error', detail: override.customMessage };
    }

    if (this.hasValidationErrors(error)) {
      const body = (error as { error: ErrorResponse }).error;
      return {
        summary: body.error || 'Validation failed',
        detail: this.formatValidationErrors(body.validationErrors ?? []),
      };
    }

    if (this.hasErrorBody(error)) {
      const body = (error as { error: Partial<ErrorResponse> }).error;
      return {
        summary: body.error || 'Error',
        detail: body.message || this.fallbackDetail(error),
      };
    }

    return { summary: 'Error', detail: this.fallbackDetail(error) };
  }

  // ============================================================================
  // Status helpers (kept for callers that branch on error type)
  // ============================================================================

  isUnauthorized(error: HttpErrorResponse | unknown): boolean {
    return this.statusOf(error) === 401;
  }

  isForbidden(error: HttpErrorResponse | unknown): boolean {
    return this.statusOf(error) === 403;
  }

  isNotFound(error: HttpErrorResponse | unknown): boolean {
    return this.statusOf(error) === 404;
  }

  isConflict(error: HttpErrorResponse | unknown): boolean {
    return this.statusOf(error) === 409;
  }

  isValidationError(error: HttpErrorResponse | unknown): boolean {
    return this.statusOf(error) === 400 && this.hasValidationErrors(error);
  }

  hasValidationErrors(error: HttpErrorResponse | unknown): boolean {
    const arr = (error as { error?: { validationErrors?: unknown[] } } | null)?.error
      ?.validationErrors;
    return Array.isArray(arr) && arr.length > 0;
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private hasErrorBody(error: unknown): boolean {
    const body = (error as { error?: Partial<ErrorResponse> } | null)?.error;
    return !!(body && (body.message || body.error));
  }

  private statusOf(error: unknown): number | undefined {
    const e = error as { status?: number; error?: { status?: number } } | null;
    return e?.status ?? e?.error?.status;
  }

  private fallbackDetail(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Network error. Unable to connect to the server.';
      if (error.statusText) return error.statusText;
      return `HTTP Error ${error.status}`;
    }
    return 'An error occurred. Please try again.';
  }

  private formatValidationErrors(validationErrors: string[]): string {
    const cleaned = validationErrors.map((line) => {
      const colon = line.indexOf(':');
      return colon > 0 ? line.substring(colon + 1).trim() : line;
    });
    return cleaned.join('\n');
  }
}
