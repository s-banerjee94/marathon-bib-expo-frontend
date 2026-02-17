import { EventStatus } from '../../core/models/event.model';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/**
 * Get PrimeNG tag severity for an event status.
 * Centralized to avoid duplication across event-related components.
 */
export function getEventStatusSeverity(status: string | EventStatus): TagSeverity {
  switch (status?.toString().toUpperCase()) {
    case EventStatus.PUBLISHED:
      return 'success';
    case EventStatus.DRAFT:
      return 'warn';
    case EventStatus.CANCELLED:
      return 'danger';
    case EventStatus.COMPLETED:
      return 'info';
    default:
      return 'secondary';
  }
}

/**
 * Get human-readable label for an event status.
 */
export function getEventStatusLabel(status: EventStatus): string {
  switch (status) {
    case EventStatus.DRAFT:
      return 'Draft';
    case EventStatus.PUBLISHED:
      return 'Published';
    case EventStatus.CANCELLED:
      return 'Cancelled';
    case EventStatus.COMPLETED:
      return 'Completed';
    default:
      return status;
  }
}
