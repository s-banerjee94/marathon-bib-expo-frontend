import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'join',
  standalone: true,
})
export class JoinPipe implements PipeTransform {
  transform(value: string[] | null | undefined, separator: string = ', '): string {
    if (!value?.length) return '--';
    return value.join(separator);
  }
}
