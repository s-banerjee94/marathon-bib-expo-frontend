import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CampaignProviderScope } from '../../../core/models/campaign-provider.model';
import { CampaignProviderConsole } from '../../campaign-providers/campaign-provider-console/campaign-provider-console';
import { OrganizationAccountState } from '../organization-account-state.service';

// Organization settings tab: the per-organization campaign sender override. When set
// and enabled, the org's campaigns send through its own provider; otherwise they fall
// back to the platform default.
@Component({
  selector: 'app-organization-settings-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CampaignProviderConsole],
  templateUrl: './organization-settings-section.html',
  styleUrl: './organization-settings-section.css',
})
export class OrganizationSettingsSection {
  private state = inject(OrganizationAccountState);

  readonly orgScope = computed<CampaignProviderScope | null>(() => {
    const id = this.state.organization()?.id;
    return id != null ? { kind: 'ORG', organizationId: id } : null;
  });
}
