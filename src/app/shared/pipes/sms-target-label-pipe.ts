import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'smsTargetLabel',
})
export class SmsTargetLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '--';
    return value === 'ALL' ? 'All' : 'Not Collected';
  }
}
