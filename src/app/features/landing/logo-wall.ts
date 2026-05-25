import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-logo-wall',
  templateUrl: './logo-wall.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoWall {
  readonly orgs: readonly string[] = [
    'SUNRISE RUNNERS',
    'HARBOR HALF CO.',
    'CITY CYCLES',
    'TRAILBLAZER',
    'NORTHFIELD TRACK',
    'IRONHEART RACE OPS',
  ];
}
