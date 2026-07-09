import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ConnectivityService } from '../../core/services/connectivity.service';

@Component({
  selector: 'app-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offline-banner.html',
})
export class OfflineBanner {
  private readonly connectivity = inject(ConnectivityService);

  // Shown app-wide whenever the device is offline. While offline, all writes are
  // blocked by offlineInterceptor, so the message tells the user changes are disabled.
  protected readonly offline = computed(() => !this.connectivity.isOnline());
}
