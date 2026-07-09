import { Pipe, PipeTransform } from '@angular/core';
import { UserQuotaDto } from '../../core/models/organization.model';

@Pipe({
  name: 'userQuota',
})
export class UserQuotaPipe implements PipeTransform {
  transform(quota: UserQuotaDto | null | undefined): string {
    if (!quota) return '--';
    return (
      `A: ${this.fmt(quota.admins?.used, quota.admins?.max)}` +
      `  U: ${this.fmt(quota.organizerUsers?.used, quota.organizerUsers?.max)}` +
      `  D: ${this.fmt(quota.distributors?.used, quota.distributors?.max)}`
    );
  }

  private fmt(used?: number, max?: number | null): string {
    return `${used ?? 0}/${max ?? '∞'}`;
  }
}
