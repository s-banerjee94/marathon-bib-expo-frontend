/**
 * Shared constants for the audit-log feature.
 *
 * AUDIT_ACTION / AUDIT_ENTITY_TYPE — the canonical enum values that mirror the
 *   backend's AuditAction / AuditEntityType. We hardcode these (instead of
 *   fetching a /lookups endpoint) so the dropdowns are available immediately
 *   and we control the display labels (no underscores).
 */

import { UserRole } from '../../core/models/user.model';

export const AUDIT_LOG_ROLES: UserRole[] = [
  UserRole.ROOT,
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

// Number of skeleton rows shown while the first page loads. Cosmetic only — the
// real page size is whatever the backend decides (currently 50 by default).
export const AUDIT_LOG_SKELETON_ROWS = 10;

// Default selection on the picker — the last 7 days.
export const AUDIT_LOG_DEFAULT_RANGE_DAYS = 7;

// Backend retains audit entries for 15 days (DynamoDB TTL); the picker clamps
// to this window so users can't request data the backend won't return.
export const AUDIT_LOG_RETENTION_DAYS = 15;

export type AuditTagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export const AUDIT_ACTION_SEVERITY: Record<string, AuditTagSeverity> = {
  CREATE: 'success',
  GENERATE: 'success',
  UPDATE: 'info',
  STATUS_CHANGE: 'info',
  // A bulk CSV import is a heavyweight operational load (delete-all + reload),
  // distinct from a single-record CREATE — blue keeps it visually apart.
  IMPORT: 'info',
  DELETE: 'danger',
  LOGIN: 'secondary',
};

export const AUDIT_ACTION_SEVERITY_DEFAULT: AuditTagSeverity = 'secondary';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  LOGIN = 'LOGIN',
  GENERATE = 'GENERATE',
  IMPORT = 'IMPORT',
}

export enum AuditEntityType {
  EVENT = 'EVENT',
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
  RACE = 'RACE',
  CATEGORY = 'CATEGORY',
  SMS_TEMPLATE = 'SMS_TEMPLATE',
  SMS_CAMPAIGN = 'SMS_CAMPAIGN',
  VERIFICATION_LINK = 'VERIFICATION_LINK',
  PARTICIPANT = 'PARTICIPANT',
}

export interface AuditOption {
  value: string;
  label: string;
}

// Display labels follow Title Case, with SMS kept uppercase since it's an acronym.
export const AUDIT_ACTION_OPTIONS: AuditOption[] = [
  { value: AuditAction.CREATE, label: 'Create' },
  { value: AuditAction.UPDATE, label: 'Update' },
  { value: AuditAction.DELETE, label: 'Delete' },
  { value: AuditAction.STATUS_CHANGE, label: 'Status Change' },
  { value: AuditAction.LOGIN, label: 'Login' },
  { value: AuditAction.GENERATE, label: 'Generate' },
  { value: AuditAction.IMPORT, label: 'Import' },
];

export const AUDIT_ENTITY_TYPE_OPTIONS: AuditOption[] = [
  { value: AuditEntityType.EVENT, label: 'Event' },
  { value: AuditEntityType.USER, label: 'User' },
  { value: AuditEntityType.ORGANIZATION, label: 'Organization' },
  { value: AuditEntityType.RACE, label: 'Race' },
  { value: AuditEntityType.CATEGORY, label: 'Category' },
  { value: AuditEntityType.SMS_TEMPLATE, label: 'SMS Template' },
  { value: AuditEntityType.SMS_CAMPAIGN, label: 'SMS Campaign' },
  { value: AuditEntityType.VERIFICATION_LINK, label: 'Verification Link' },
  { value: AuditEntityType.PARTICIPANT, label: 'Participant' },
];

// Lookup tables for rendering the raw enum on existing log rows.
export const AUDIT_ACTION_LABEL: Record<string, string> = Object.fromEntries(
  AUDIT_ACTION_OPTIONS.map((o) => [o.value, o.label]),
);

export const AUDIT_ENTITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  AUDIT_ENTITY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

// Activity-row icons — mirrors the dashboard's Recent Activity card visual language
// (org-shared/org-dashboard). Resolution: specific (action,entity) override first,
// then entity icon, then action icon, then a neutral fallback.
const AUDIT_ENTITY_ICON: Record<string, string> = {
  [AuditEntityType.EVENT]: 'pi pi-calendar',
  [AuditEntityType.USER]: 'pi pi-user',
  [AuditEntityType.ORGANIZATION]: 'pi pi-building',
  [AuditEntityType.RACE]: 'pi pi-flag',
  [AuditEntityType.CATEGORY]: 'pi pi-tag',
  [AuditEntityType.SMS_TEMPLATE]: 'pi pi-comment',
  [AuditEntityType.SMS_CAMPAIGN]: 'pi pi-send',
  [AuditEntityType.VERIFICATION_LINK]: 'pi pi-link',
  [AuditEntityType.PARTICIPANT]: 'pi pi-users',
};

const AUDIT_ACTION_ICON: Record<string, string> = {
  [AuditAction.CREATE]: 'pi pi-plus-circle',
  [AuditAction.UPDATE]: 'pi pi-pencil',
  [AuditAction.DELETE]: 'pi pi-trash',
  [AuditAction.STATUS_CHANGE]: 'pi pi-refresh',
  [AuditAction.LOGIN]: 'pi pi-sign-in',
  [AuditAction.GENERATE]: 'pi pi-bolt',
  [AuditAction.IMPORT]: 'pi pi-upload',
};

const AUDIT_ACTIVITY_ICON_OVERRIDE: Record<string, string> = {
  [`${AuditAction.CREATE}:${AuditEntityType.EVENT}`]: 'pi pi-calendar-plus',
  [`${AuditAction.DELETE}:${AuditEntityType.EVENT}`]: 'pi pi-calendar-minus',
  [`${AuditAction.CREATE}:${AuditEntityType.USER}`]: 'pi pi-user-plus',
  [`${AuditAction.DELETE}:${AuditEntityType.USER}`]: 'pi pi-user-minus',
  // IMPORT always targets PARTICIPANT — prefer the upload glyph over the generic
  // participant icon so a bulk import reads as an import in the activity feed.
  [`${AuditAction.IMPORT}:${AuditEntityType.PARTICIPANT}`]: 'pi pi-upload',
};

export function resolveAuditActivityIcon(action: string, entityType: string): string {
  const override = AUDIT_ACTIVITY_ICON_OVERRIDE[`${action}:${entityType}`];
  if (override) return override;
  // LOGIN/GENERATE don't carry a meaningful entity icon — prefer the action one.
  if (action === AuditAction.LOGIN || action === AuditAction.GENERATE) {
    return AUDIT_ACTION_ICON[action];
  }
  return AUDIT_ENTITY_ICON[entityType] ?? AUDIT_ACTION_ICON[action] ?? 'pi pi-circle';
}
