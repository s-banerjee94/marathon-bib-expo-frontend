import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';

interface Tier {
  name: string;
  price: string;
  desc: string;
  featured: boolean;
  caps: readonly string[];
  cta: string;
}

@Component({
  selector: 'app-pricing',
  imports: [ButtonModule],
  templateUrl: './pricing.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pricing {
  readonly tiers: readonly Tier[] = [
    {
      name: 'Free',
      price: '0',
      desc: 'For first-time event organizers, club fun runs, and pilot events.',
      featured: false,
      caps: [
        'Up to 200 participants per event',
        '1 organizer · 2 distributors',
        'Email support',
        'Single event only',
      ],
      cta: 'Start free',
    },
    {
      name: 'Standard',
      price: '149',
      desc: 'For weekly 5K series and mid-size half-marathons.',
      featured: true,
      caps: [
        'Up to 5,000 participants per event',
        'Unlimited organizers + distributors',
        'CSV batch import',
        'SMS campaigns (1,000/mo)',
        'Priority email support',
      ],
      cta: 'Choose Standard',
    },
    {
      name: 'Premium',
      price: '499',
      desc: 'For race-management companies and federations.',
      featured: false,
      caps: [
        'Unlimited participants',
        'Unlimited events + organizations',
        'White-label dashboards',
        'Bulk SMS (50,000/mo)',
        'Dedicated success manager',
        'SLA: 99.95% race-day uptime',
      ],
      cta: 'Choose Premium',
    },
  ];
}
