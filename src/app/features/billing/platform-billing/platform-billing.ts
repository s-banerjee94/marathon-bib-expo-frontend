import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { MobileTabBar, TabItem } from '../../../shared/components/mobile-tab-bar/mobile-tab-bar';

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
  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_TAB),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_TAB },
  );

  protected readonly tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: 'pi-chart-bar' },
    { id: 'all-bills', label: 'All Bills', icon: 'pi-list' },
  ];

  onTabChange(tabId: string): void {
    this.router.navigate([tabId], { relativeTo: this.route });
  }
}
