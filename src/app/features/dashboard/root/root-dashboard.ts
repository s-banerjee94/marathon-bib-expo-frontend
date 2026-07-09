import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlatformDashboard } from '../admin-shared/platform-dashboard/platform-dashboard';

@Component({
  selector: 'app-root-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlatformDashboard],
  template: `<app-platform-dashboard />`,
})
export class RootDashboard {}
