import { Pipe, PipeTransform } from '@angular/core';
import { AuditEntityType } from '../constants/audit-log.constant';

/**
 * Maps an audit log row to a router-link command array.
 *
 * Returns null when the row can't be deep-linked from `entityId` alone — e.g.
 * a race/category needs an event id in its URL, which the audit payload
 * doesn't carry. The caller should render the entity name as plain text when
 * the pipe returns null.
 */
@Pipe({
  name: 'auditEntityRoute',
})
export class AuditEntityRoutePipe implements PipeTransform {
  transform(
    entityType: string | null | undefined,
    entityId: string | number | null | undefined,
  ): (string | number)[] | null {
    if (!entityType || entityId === null || entityId === undefined || entityId === '') {
      return null;
    }

    switch (entityType) {
      case AuditEntityType.EVENT:
        return ['/events', entityId];
      case AuditEntityType.USER:
        return ['/users', entityId, 'edit'];
      case AuditEntityType.ORGANIZATION:
        return ['/organizations', entityId, 'edit'];
      default:
        return null;
    }
  }
}
