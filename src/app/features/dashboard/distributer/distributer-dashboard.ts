import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder distributor dashboard. A distributor does their work on the
 * Distribution screen (which opens straight on their assigned event), so this is
 * a "coming soon" stub until a dedicated dashboard is built.
 */
@Component({
  selector: 'app-distributer-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './distributer-dashboard.html',
})
export class DistributerDashboard {}
