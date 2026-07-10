import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LetterPop } from './letter-pop';
import { ScrollReveal } from './scroll-reveal';
import { TiltCard } from './tilt-card';

@Component({
  selector: 'app-runner-spotlight',
  imports: [ScrollReveal, TiltCard, LetterPop],
  templateUrl: './runner-spotlight.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunnerSpotlight {}
