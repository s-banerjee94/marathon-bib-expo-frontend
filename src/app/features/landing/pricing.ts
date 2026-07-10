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
      name: 'Pay-as-you-go',
      price: 'Included to start',
      desc: 'The default for every new organization — pilot an event before committing to a season.',
      featured: false,
      caps: [
        'Full event & roster tooling',
        'SMS · WhatsApp · Email campaigns',
        'QR scanning & distribution',
        'Standard support',
      ],
      cta: 'Book a demo',
    },
    {
      name: 'Premium',
      price: 'Sized to your season',
      desc: 'For organizations running a full calendar of events with a dedicated ops team.',
      featured: true,
      caps: [
        'Everything in Pay-as-you-go',
        'Higher participant & user limits',
        'AI assistant included',
        'Priority support',
      ],
      cta: 'Book a demo',
    },
    {
      name: 'Partner',
      price: 'Custom',
      desc: 'For race-management companies and federations running many organizations at once.',
      featured: false,
      caps: [
        'Everything in Premium',
        'Multi-organization rollup',
        'Dedicated success contact',
        'Custom onboarding',
      ],
      cta: 'Talk to sales',
    },
  ];
}
