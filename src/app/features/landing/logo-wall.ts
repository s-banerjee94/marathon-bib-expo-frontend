import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-logo-wall',
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
