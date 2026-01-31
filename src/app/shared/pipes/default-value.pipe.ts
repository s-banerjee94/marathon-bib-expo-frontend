import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe to display a default value (--) when the input is null, undefined, or empty string
 */
@Pipe({
  name: 'defaultValue',
  standalone: true,
})
export class DefaultValuePipe implements PipeTransform {
  transform<T>(value: T | null | undefined, defaultValue: string = '--'): T | string {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    return value;
  }
}
