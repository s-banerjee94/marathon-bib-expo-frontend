import { Pipe, PipeTransform } from '@angular/core';

/**
 * Extracts the display username from a backend actor reference of the form
 * "id__|__username" (e.g. createdBy / updatedBy / bibDistributedBy / performedBy).
 * Returns the username part only; falls back to the raw value when there is no
 * separator, and to '--' when empty.
 *
 * Usage: {{ participant.bibDistributedBy | userName }}
 */
@Pipe({
  name: 'userName',
})
export class UserNamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '--';
    const parts = value.split('__|__');
    return parts.length > 1 ? parts[1] : value;
  }
}
