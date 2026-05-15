import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'smsTriggerLabel',
})
export class SmsTriggerLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    switch (value) {
      case 'AUTO_BIB_COLLECTED':
        return 'Auto (Bib Collected)';
      case 'SCHEDULED':
        return 'Scheduled';
      default:
        return value ?? '--';
    }
  }
}
