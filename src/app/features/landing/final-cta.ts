import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LetterPop } from './letter-pop';
import { Magnetic } from './magnetic';
import { ScrollReveal } from './scroll-reveal';

@Component({
  selector: 'app-final-cta',
  imports: [RouterLink, ButtonModule, Magnetic, ScrollReveal, LetterPop],
  templateUrl: './final-cta.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalCta {}
