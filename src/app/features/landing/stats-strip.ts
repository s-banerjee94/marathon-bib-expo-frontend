import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Stat {
  num: string;
  unit: string;
  cap: string;
}

@Component({
  selector: 'app-stats-strip',
  templateUrl: './stats-strip.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsStrip {
  readonly stats: readonly Stat[] = [
    { num: '1.2', unit: 'M', cap: 'Participants processed' },
    { num: '4,800', unit: '+', cap: 'Race events run' },
    { num: '38', unit: '', cap: 'Countries served' },
    { num: '99.96', unit: '%', cap: 'Race-day uptime' },
  ];
}
