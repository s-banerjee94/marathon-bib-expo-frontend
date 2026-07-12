import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LetterPop } from './letter-pop';
import { Magnetic } from './magnetic';
import { ScrollReveal } from './scroll-reveal';
import { Spotlight } from './spotlight';

@Component({
  selector: 'app-final-cta',
  imports: [RouterLink, ButtonModule, Magnetic, ScrollReveal, LetterPop, Spotlight],
  templateUrl: './final-cta.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalCta {}
