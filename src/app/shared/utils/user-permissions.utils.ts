import { User, UserRole } from '../../core/models/user.model';

// Mirror of backend's user-management hierarchy. Used by both UserList (to gate the
// edit/delete row actions) and UserForm (to short-circuit an unauthorized edit before
// the user fills in changes that the backend would reject on submit).
export function userCanManage(currentUser: User | null, targetUser: User): boolean {
  if (!currentUser) return false;
  if (targetUser.id === currentUser.id) return false;
  if (targetUser.role === UserRole.ROOT) return false;

  switch (currentUser.role) {
    case UserRole.ROOT:
      return true;
    case UserRole.ADMIN:
      return targetUser.role !== UserRole.ADMIN;
    case UserRole.ORGANIZER_ADMIN:
      return (
        (targetUser.role === UserRole.ORGANIZER_USER || targetUser.role === UserRole.DISTRIBUTOR) &&
        targetUser.organizationId === currentUser.organizationId
      );
    case UserRole.ORGANIZER_USER:
      return (
        targetUser.role === UserRole.DISTRIBUTOR &&
        targetUser.organizationId === currentUser.organizationId
      );
    default:
      return false;
  }
}

// Mirror of the backend's password-reset-link rule: the userCanManage hierarchy,
// with ROOT allowed to target any other user (including other ROOTs). Your own
// account is always blocked (400 — use change/forgot password instead), and
// DISTRIBUTOR can't call the endpoint at all.
export function userCanIssueResetLink(currentUser: User | null, targetUser: User): boolean {
  if (!currentUser || currentUser.role === UserRole.DISTRIBUTOR) return false;
  if (targetUser.id === currentUser.id) return false;
  if (currentUser.role === UserRole.ROOT) return true;
  return userCanManage(currentUser, targetUser);
}

// Mirror of the backend's toggle-enabled rule: self-disable is blocked for everyone,
// ROOT may disable any OTHER user (including other ROOTs — wider than userCanManage),
// and the remaining roles follow the userCanManage hierarchy (ADMIN → org roles only,
// org roles scoped to their own organization, DISTRIBUTOR → none).
export function userCanToggleEnabled(currentUser: User | null, targetUser: User): boolean {
  if (!currentUser || targetUser.id === currentUser.id) return false;
  if (currentUser.role === UserRole.ROOT) return true;
  return userCanManage(currentUser, targetUser);
}

// Mirror of the backend's toggle-locked rule: ROOT/ADMIN only, never yourself.
// Within that, the target scope is the same as toggle-enabled (ROOT → any other
// user; ADMIN → ORGANIZER_ADMIN / ORGANIZER_USER / DISTRIBUTOR).
export function userCanToggleLocked(currentUser: User | null, targetUser: User): boolean {
  if (currentUser?.role !== UserRole.ROOT && currentUser?.role !== UserRole.ADMIN) return false;
  return userCanToggleEnabled(currentUser, targetUser);
}
