import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a scheduled date+time string pair in a specific event timezone.
 *
 * Usage:
 *   {{ scheduledDate | formatEventDateTime:scheduledTime:timezone }}
 *   // '15 Jan 2025, 09:30 AM'
 *
 *   {{ scheduledDate | formatEventDateTime:scheduledTime:timezone:'abbr' }}
 *   // 'GST' (timezone abbreviation for that specific date — DST-aware)
 */
@Pipe({
  name: 'formatEventDateTime',
  standalone: true,
})
export class FormatEventDateTimePipe implements PipeTransform {
  transform(
    date: string | null | undefined,
    time?: string,
    timezone?: string,
    mode: 'datetime' | 'abbr' = 'datetime',
  ): string {
    if (!date) return '--';

    const [year, month, day] = date.split('-').map(Number);

    if (mode === 'abbr') {
      if (!timezone) return '';
      try {
        const parts = new Intl.DateTimeFormat('en', {
          timeZone: timezone,
          timeZoneName: 'short',
        }).formatToParts(new Date(year, month - 1, day, 12));
        return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
      } catch {
        return '';
      }
    }

    const d = new Date(year, month - 1, day);
    const dateStr = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    if (!time) return dateStr;

    const [h, m] = time.split(':').map(Number);
    const timeStr = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(year, month - 1, day, h, m));

    return `${dateStr}, ${timeStr}`;
  }
}
