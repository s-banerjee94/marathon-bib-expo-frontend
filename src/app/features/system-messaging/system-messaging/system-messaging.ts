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
import { DEFAULT_CHANNEL, SYSTEM_MESSAGING_CHANNELS } from '../system-messaging.constants';
import { activeChildRouteSignal } from '../../../shared/utils/active-route.utils';

@Component({
  selector: 'app-system-messaging',
  imports: [TabsModule, RouterLink, RouterLinkActive, RouterOutlet, MobileTabBar],
  templateUrl: './system-messaging.html',
  styleUrl: './system-messaging.css',
})
export class SystemMessaging {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly channels = SYSTEM_MESSAGING_CHANNELS;

  // Mobile bar wants the icon without the leading `pi ` family class.
  protected readonly tabs: TabItem[] = SYSTEM_MESSAGING_CHANNELS.map((c) => ({
    id: c.value,
    label: c.label,
    icon: c.icon.replace('pi ', ''),
  }));

  // The active channel is the :channel param of whichever child is showing
  // (console or template editor), falling back to the default tab.
  protected readonly activeTab = activeChildRouteSignal(
    (root) => root.firstChild?.paramMap.get('channel') ?? undefined,
    DEFAULT_CHANNEL,
  );

  onTabChange(tabId: string): void {
    this.router.navigate([tabId], { relativeTo: this.route });
  }
}
