import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WhatsappConfigCard } from './whatsapp-config-card/whatsapp-config-card';

@Component({
  selector: 'app-organization-settings-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WhatsappConfigCard],
  templateUrl: './organization-settings-section.html',
  styleUrl: './organization-settings-section.css',
})
export class OrganizationSettingsSection {}
