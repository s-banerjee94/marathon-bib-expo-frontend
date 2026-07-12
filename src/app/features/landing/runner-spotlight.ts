import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LetterPop } from './letter-pop';
import { ScrollReveal } from './scroll-reveal';
import { Sheen } from './sheen';
import { Spotlight } from './spotlight';
import { TiltCard } from './tilt-card';

@Component({
  selector: 'app-runner-spotlight',
  imports: [ScrollReveal, TiltCard, LetterPop, Sheen, Spotlight],
  templateUrl: './runner-spotlight.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunnerSpotlight {}
