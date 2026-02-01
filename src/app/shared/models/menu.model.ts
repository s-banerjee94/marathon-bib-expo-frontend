import { UserRole } from '../../core/models/user.model';

export interface AppMenuItem {
  label: string;
  icon?: string;
  routerLink?: string;
  items?: AppMenuItem[];
  roles?: UserRole[];
  separator?: boolean;
  badge?: string;
  badgeClass?: string;
}

export interface AppMenuItemCommand {
  originalEvent: Event;
  item: AppMenuItem;
}
