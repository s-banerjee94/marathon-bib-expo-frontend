import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
})
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, maxLength: number = 50): string {
    if (!value) return '--';
    return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
  }
}
