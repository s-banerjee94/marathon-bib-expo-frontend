import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Hero } from './hero';
import { LogoWall } from './logo-wall';
import { StatsStrip } from './stats-strip';
import { Features } from './features';
import { HowItWorks } from './how-it-works';
import { Roles } from './roles';
import { RunnerSpotlight } from './runner-spotlight';
import { Pricing } from './pricing';
import { Faq } from './faq';
import { FinalCta } from './final-cta';
import { SiteFooter } from './site-footer';

@Component({
  selector: 'app-landing',
  imports: [
    Hero,
    LogoWall,
    StatsStrip,
    Features,
    HowItWorks,
    Roles,
    RunnerSpotlight,
    Pricing,
    Faq,
    FinalCta,
    SiteFooter,
  ],
  templateUrl: './landing.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {}
