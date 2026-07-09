import { Pipe, PipeTransform } from '@angular/core';

// Domain acronyms that should stay fully uppercase when labelized.
const ACRONYMS = new Set(['BIB', 'CHIP', 'SMS', 'ID', 'URL', 'CSV', 'QR']);

/**
 * Turns SNAKE_CASE enum values and camelCase identifiers into human-friendly
 * Title Case labels (e.g. 'VALIDATION_ERROR' -> 'Validation Error',
 * 'bibNumber' -> 'BIB Number'). Known acronyms are preserved in uppercase.
 */
@Pipe({
  name: 'labelize',
})
export class LabelizePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '--';
    }

    return value
      .replace(/_/g, ' ') // snake_case -> spaces
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase -> spaces
      .trim()
      .split(/\s+/)
      .map((word) => {
        const upper = word.toUpperCase();
        if (ACRONYMS.has(upper)) {
          return upper;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }
}
