import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OrgDashboard } from '../org-shared/org-dashboard';

@Component({
  selector: 'app-org-user-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrgDashboard],
  template: `<app-org-dashboard />`,
})
export class OrgUserDashboard {}
