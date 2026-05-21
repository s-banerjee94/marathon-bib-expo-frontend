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
