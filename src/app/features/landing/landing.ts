import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Hero } from './hero';
import { LogoWall } from './logo-wall';
import { StatsStrip } from './stats-strip';
import { Features } from './features';
import { HowItWorks } from './how-it-works';
import { Roles } from './roles';
import { RunnerSpotlight } from './runner-spotlight';
import { Pricing } from './pricing';
import { Faq } from './faq';
import { FinalCta } from './final-cta';
import { SiteFooter } from './site-footer';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-landing',
  imports: [
    Hero,
    LogoWall,
    StatsStrip,
    Features,
    HowItWorks,
    Roles,
    RunnerSpotlight,
    Pricing,
    Faq,
    FinalCta,
    SiteFooter,
  ],
  templateUrl: './landing.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  private readonly progressBar = viewChild.required<ElementRef<HTMLElement>>('progressBar');
  private readonly progressRunner = viewChild.required<ElementRef<HTMLElement>>('progressRunner');

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const setScale = gsap.quickSetter(this.progressBar().nativeElement, 'scaleX');
          const setX = gsap.quickSetter(this.progressRunner().nativeElement, 'x', 'px');
          const st = ScrollTrigger.create({
            trigger: host,
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: (self) => {
              setScale(self.progress);
              setX(self.progress * (window.innerWidth - 22));
            },
          });
          return () => st.kill();
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
