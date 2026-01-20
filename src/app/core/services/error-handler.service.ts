import { Injectable, inject, Optional } from '@angular/core';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorResponse, ErrorOverride } from '../models/error.model';

@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  private messageService = inject(MessageService, { optional: true });

  /**
   * Set MessageService instance (for components that provide their own MessageService)
   * This allows components with MessageService provider to pass their instance to the error handler
   */
  setMessageService(messageService: MessageService): void {
    this.messageService = messageService;
  }

  /**
   * Extract user-friendly error message from error response
   * Handles ErrorResponse from backend, HttpErrorResponse, or generic errors
   */
  getErrorMessage(error: any, override?: ErrorOverride): string {
    // If override has custom message, use it
    if (override?.customMessage) {
      return override.customMessage;
    }

    // Check for validation errors first - if present, show ONLY those (more specific)
    if (this.hasValidationErrors(error)) {
      return this.formatValidationErrors(error.error.validationErrors);
    }

    // Check for HTTP error response with error body
    if (error?.error?.message) {
      return error.error.message;
    }

    // Handle HttpErrorResponse without body
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Network error. Unable to connect to the server.';
      }

      if (error.statusText) {
        return error.statusText;
      }

      return `HTTP Error ${error.status}`;
    }

    // Generic fallback
    return 'An error occurred. Please try again.';
  }

  /**
   * Display error as a PrimeNG toast notification
   * Only displays toast if MessageService is provided
   */
  showError(error: any, summary?: string, override?: ErrorOverride): void {
    // Skip if override explicitly disables toast
    if (override?.showToast === false) {
      return;
    }

    // Only show toast if MessageService is available
    if (!this.messageService) {
      return;
    }

    const message = this.getErrorMessage(error, override);
    this.messageService.add({
      severity: 'error',
      summary: summary || 'Error',
      detail: message,
      life: 5000,
    });
  }

  /**
   * Format validation errors array into readable string
   * Parses "fieldName: error message" format and extracts just the error message
   */
  formatValidationErrors(validationErrors: string[]): string {
    if (!Array.isArray(validationErrors) || validationErrors.length === 0) {
      return '';
    }

    // Parse errors to extract just the message part (after the field name)
    const cleanedErrors = validationErrors.map((error) => {
      // Check if error follows "fieldName: message" format
      const colonIndex = error.indexOf(':');
      if (colonIndex > 0) {
        // Extract message part after field name and colon
        return error.substring(colonIndex + 1).trim();
      }
      return error;
    });

    if (cleanedErrors.length === 1) {
      return cleanedErrors[0];
    }

    // Multiple errors: format as readable list
    return cleanedErrors.join('\n');
  }

  /**
   * Check if error has validation errors array
   */
  hasValidationErrors(error: any): boolean {
    return (
      error?.error?.validationErrors &&
      Array.isArray(error.error.validationErrors) &&
      error.error.validationErrors.length > 0
    );
  }

  /**
   * Check if error is unauthorized (401)
   */
  isUnauthorized(error: any): boolean {
    return error?.status === 401 || error?.error?.status === 401;
  }

  /**
   * Check if error is forbidden (403)
   */
  isForbidden(error: any): boolean {
    return error?.status === 403 || error?.error?.status === 403;
  }

  /**
   * Check if error is not found (404)
   */
  isNotFound(error: any): boolean {
    return error?.status === 404 || error?.error?.status === 404;
  }

  /**
   * Check if error is conflict (409) - typically duplicate resource
   */
  isConflict(error: any): boolean {
    return error?.status === 409 || error?.error?.status === 409;
  }

  /**
   * Check if error is validation error (400 with validationErrors)
   */
  isValidationError(error: any): boolean {
    const status = error?.status || error?.error?.status;
    return status === 400 && this.hasValidationErrors(error);
  }
}
