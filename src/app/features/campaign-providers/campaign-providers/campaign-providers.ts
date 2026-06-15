import { Component } from '@angular/core';
import { CampaignProviderScope } from '../../../core/models/campaign-provider.model';
import { CampaignProviderConsole } from '../campaign-provider-console/campaign-provider-console';

// ROOT-only platform-default campaign senders (SMS | WhatsApp). Organizations without
// their own override send through whatever is configured here.
@Component({
  selector: 'app-campaign-providers',
  imports: [CampaignProviderConsole],
  templateUrl: './campaign-providers.html',
  styleUrl: './campaign-providers.css',
})
export class CampaignProviders {
  readonly systemScope: CampaignProviderScope = { kind: 'SYSTEM' };
}
