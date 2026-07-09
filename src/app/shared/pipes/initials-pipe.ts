import { Pipe, PipeTransform } from '@angular/core';

/**
 * Builds avatar initials from a name: the first letter of each word, uppercased,
 * capped at `max` letters (default 3). Non-alphanumeric leading characters are
 * skipped, so a transient placeholder like "Org #123" yields "O" rather than "O#".
 *
 * Usage: {{ organizerName | initials }}  ·  {{ name | initials: 2 }}
 */
@Pipe({
  name: 'initials',
})
export class InitialsPipe implements PipeTransform {
  transform(value: string | null | undefined, max = 3): string {
    if (!value) return '?';
    const letters = value
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .filter((char) => char && /[a-z0-9]/i.test(char));
    return letters.length ? letters.slice(0, max).join('').toUpperCase() : '?';
  }
}
