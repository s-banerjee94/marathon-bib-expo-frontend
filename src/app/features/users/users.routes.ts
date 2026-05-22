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
    loadComponent: () => import('../user-list/user-list').then((m) => m.UserList),
    canActivate: [roleGuard(USER_ROLES)],
    title: pageTitle('Users'),
    children: [
      {
        path: 'new',
        loadComponent: () => import('../user-form/user-form').then((m) => m.UserForm),
        title: pageTitle('New User'),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('../user-form/user-form').then((m) => m.UserForm),
        title: pageTitle('Edit User'),
      },
    ],
  },
];
