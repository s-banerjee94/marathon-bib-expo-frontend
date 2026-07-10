import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScrollReveal } from './scroll-reveal';

@Component({
  selector: 'app-logo-wall',
  imports: [ScrollReveal],
  templateUrl: './logo-wall.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoWall {
  readonly orgs: readonly string[] = [
    '5K & 10K',
    'HALF MARATHON',
    'FULL MARATHON',
    'TRAIL & ULTRA',
    'RELAY',
    'MULTI-DAY STAGE RACE',
  ];
}
