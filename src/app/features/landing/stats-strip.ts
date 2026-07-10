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
    { num: '5,000', unit: '+', cap: 'Runners at a big expo' },
    { num: '1–2', unit: '', cap: 'Days to hand out every bib' },
    { num: '3', unit: '', cap: 'Message channels built in' },
    { num: '3', unit: '', cap: 'Roles inside your organization' },
  ];
}
