import { UserRole } from '../../core/models/user.model';

export interface AppMenuItem {
  label: string;
  icon?: string;
  routerLink: string;
  roles?: UserRole[];
}
