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

/**
 * Parse a date-of-birth string in either ISO (yyyy-MM-dd) or dd-MM-yyyy form.
 */
export function parseDob(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{2})-(\d{2})-(\d{4})/.exec(value);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  return null;
}

/**
 * Humanize a goodies key, e.g. "t_shirt-size" → "T Shirt Size".
 */
export function formatGoodiesKey(key: string): string {
  return key
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
