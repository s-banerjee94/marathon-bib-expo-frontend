import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-email-campaign-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './email-campaign-section.html',
  styleUrl: './email-campaign-section.css',
})
export class EmailCampaignSection {}
