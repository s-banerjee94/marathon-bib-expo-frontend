import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { pageTitle } from '../../shared/constants/app.constant';
import { AUDIT_LOG_ROLES } from '../../shared/constants/audit-log.constant';

export const AUDIT_LOGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./audit-log-list/audit-log-list').then((m) => m.AuditLogList),
    canActivate: [roleGuard(AUDIT_LOG_ROLES)],
    title: pageTitle('Audit Logs'),
  },
];
