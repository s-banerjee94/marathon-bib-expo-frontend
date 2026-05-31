import { Pipe, PipeTransform } from '@angular/core';
import { AuditEntityType } from '../constants/audit-log.constant';

/**
 * Maps an audit log row to a router-link command array.
 *
 * Returns null when the row can't be deep-linked from `entityId` alone — e.g.
 * a race/category needs an event id in its URL, which the audit payload
 * doesn't carry. The caller should render the entity name as plain text when
 * the pipe returns null.
 *
 * A PARTICIPANT row is always a bulk import (action=IMPORT): its `entityId` is
 * the event the file loaded into, so it links to that event just like an EVENT
 * row (the visible label stays the uploaded file name).
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
      // PARTICIPANT only ever appears on a bulk-import row, whose entityId is the
      // target event id — so it deep-links to the event, same as an EVENT row.
      case AuditEntityType.EVENT:
      case AuditEntityType.PARTICIPANT:
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
