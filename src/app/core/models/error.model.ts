/**
 * Error response model matching backend API schema
 * Based on swagger.json ErrorResponse structure
 */
export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  validationErrors?: string[];
}

/**
 * Error override options for component-level customization
 */
export interface ErrorOverride {
  status?: number;
  customMessage?: string;
  showToast?: boolean;
}
