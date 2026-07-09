import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';

const USER_ROLES = [
  UserRole.ROOT,
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-list/user-list').then((m) => m.UserList),
    canActivate: [roleGuard(USER_ROLES)],
    title: pageTitle('Users'),
  },
  {
    // Row "edit" opens the full-page user view/edit (not a dialog). Create is a dialog.
    path: ':id/edit',
    loadComponent: () => import('../user-account/user-account').then((m) => m.UserAccount),
    canActivate: [roleGuard(USER_ROLES)],
    title: pageTitle('Manage User'),
  },
];
