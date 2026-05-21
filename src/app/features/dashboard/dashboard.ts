import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { RootDashboard } from '../root-dashboard/root-dashboard';
import { AdminDashboard } from '../admin-dashboard/admin-dashboard';
import { OrgAdminDashboard } from '../org-admin-dashboard/org-admin-dashboard';
import { OrgUserDashboard } from '../org-user-dashboard/org-user-dashboard';
import { DistributerDashboard } from '../distributer-dashboard/distributer-dashboard';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RootDashboard,
    AdminDashboard,
    OrgAdminDashboard,
    OrgUserDashboard,
    DistributerDashboard,
  ],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly UserRole = UserRole;
  private authService = inject(AuthService);
  protected role = computed(() => this.authService.getCurrentRole());
}
