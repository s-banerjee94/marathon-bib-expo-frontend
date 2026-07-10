import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-runner-spotlight',
  templateUrl: './runner-spotlight.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunnerSpotlight {}
