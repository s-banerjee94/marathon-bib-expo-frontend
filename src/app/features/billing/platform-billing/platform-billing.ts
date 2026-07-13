import { Component, inject } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { MobileTabBar, TabItem } from '../../../shared/components/mobile-tab-bar/mobile-tab-bar';
import { activeChildRouteSignal, firstChildPath } from '../../../shared/utils/active-route.utils';

const DEFAULT_TAB = 'overview';

@Component({
  selector: 'app-platform-billing',
  imports: [TabsModule, RouterLink, RouterLinkActive, RouterOutlet, MobileTabBar],
  templateUrl: './platform-billing.html',
  styleUrl: './platform-billing.css',
})
export class PlatformBilling {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Active tab is driven by the URL (the child route path), so deep links and
  // refreshes land on the right tab.
  protected readonly activeTab = activeChildRouteSignal(firstChildPath, DEFAULT_TAB);

  protected readonly tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: 'pi-chart-bar' },
    { id: 'all-bills', label: 'All Bills', icon: 'pi-list' },
  ];

  onTabChange(tabId: string): void {
    this.router.navigate([tabId], { relativeTo: this.route });
  }
}
