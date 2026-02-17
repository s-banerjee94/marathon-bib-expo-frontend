import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a date/time string for display.
 * Replaces duplicated formatDateTime methods across components.
 *
 * Usage:
 *   {{ dateString | formatDateTime }}           // 'Jan 15, 2025, 02:30 PM'
 *   {{ dateString | formatDateTime:'date' }}    // 'Jan 15, 2025'
 */
@Pipe({
  name: 'formatDateTime',
  standalone: true,
})
export class FormatDateTimePipe implements PipeTransform {
  transform(value: string | Date | undefined | null, mode: 'full' | 'date' = 'full'): string {
    if (!value) return '--';

    const date = new Date(value);

    if (mode === 'date') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
