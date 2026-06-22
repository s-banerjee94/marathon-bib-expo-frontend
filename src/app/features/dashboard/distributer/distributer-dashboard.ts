import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { EventDashboardSection } from '../../events/event-details/event-dashboard-section/event-dashboard-section';
import { EmptyIllustration } from '../../../shared/illustrations/empty-illustration';

/**
 * A distributor is bound to a single event, so their dashboard is simply that
 * event's dashboard. Reuses the same EventDashboardSection shown in the events
 * and distribution shells, scoped to the assigned event.
 */
@Component({
  selector: 'app-distributer-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EventDashboardSection, EmptyIllustration],
  templateUrl: './distributer-dashboard.html',
})
export class DistributerDashboard {
  private readonly authService = inject(AuthService);
  protected readonly eventId = computed(() => this.authService.currentUser()?.eventId ?? null);
}
