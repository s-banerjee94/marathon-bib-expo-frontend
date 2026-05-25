import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Step {
  num: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-how-it-works',
  templateUrl: './how-it-works.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorks {
  readonly steps: readonly Step[] = [
    {
      num: '01',
      title: 'Spin up your event',
      body: 'Create the event, define races (Full, Half, 10K), add categories (age × gender). Five minutes.',
    },
    {
      num: '02',
      title: 'Import the roster',
      body: 'Drop in a CSV — chip numbers, bibs, sizes, goodies. Validation runs in the background; errors come back itemized.',
    },
    {
      num: '03',
      title: 'Distribute on race day',
      body: 'Volunteers open the distributor view. Look up. Tick. Done. Average handout time: 18 seconds.',
    },
    {
      num: '04',
      title: 'Settle the books',
      body: 'Pull the collection report. See who picked up, who didn’t, who lost a bib. Export to CSV for the federation audit.',
    },
  ];
}
