/**
 * PrimeNG Tag severity type
 */
export type TagSeverity =
  | 'success'
  | 'info'
  | 'warn'
  | 'danger'
  | 'secondary'
  | 'contrast'
  | undefined;

/**
 * Get display text for gender code
 */
export function getGenderDisplay(gender: string | undefined): string {
  switch (gender) {
    case 'M':
      return 'Male';
    case 'F':
      return 'Female';
    case 'O':
      return 'Other';
    default:
      return '--';
  }
}

/**
 * Get PrimeNG tag severity for gender
 */
export function getGenderSeverity(gender: string | undefined): TagSeverity {
  switch (gender) {
    case 'M':
      return 'info';
    case 'F':
      return 'danger';
    case 'O':
      return 'warn';
    default:
      return 'secondary';
  }
}

/**
 * Get PrimeNG tag severity for import status
 */
export function getImportStatusSeverity(status: string): TagSeverity {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
    case 'PROCESSING':
      return 'info';
    case 'FAILED':
      return 'danger';
    case 'PARTIAL':
      return 'warn';
    default:
      return 'secondary';
  }
}

/**
 * Get keys from goodies object
 */
export function getGoodiesKeys(goodies: { [key: string]: string } | undefined): string[] {
  return goodies ? Object.keys(goodies) : [];
}
