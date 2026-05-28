// Audit log read-model. Backend exposes:
//   GET /audit-logs -> AuditLogListResponse (cursor-paginated via lastEvaluatedKey/hasMore)
//
// Action / entity-type dropdown values are hardcoded on the client — see
// AUDIT_ACTION_OPTIONS and AUDIT_ENTITY_TYPE_OPTIONS in
// src/app/shared/constants/audit-log.constant.ts.

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  entityLabel?: string;
  actorName?: string;
  description?: string;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  count: number;
  lastEvaluatedKey: string | null;
  hasMore: boolean;
}

export interface AuditLogQuery {
  organizationId?: number;
  from?: string;
  to?: string;
  action?: string;
  entityType?: string;
  username?: string;
  lastEvaluatedKey?: string;
}
