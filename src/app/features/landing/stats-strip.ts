import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollReveal } from './scroll-reveal';

gsap.registerPlugin(ScrollTrigger);

interface Stat {
  num: string;
  unit: string;
  cap: string;
}

@Component({
  selector: 'app-stats-strip',
  imports: [ScrollReveal],
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

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          for (const el of Array.from(host.querySelectorAll<HTMLElement>('[data-count]'))) {
            const finalText = el.textContent ?? '';
            const target = Number(finalText.replaceAll(',', ''));
            if (!Number.isFinite(target)) {
              continue;
            }
            const state = { value: 0 };
            gsap.to(state, {
              value: target,
              duration: 1.8,
              ease: 'power2.out',
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
              onUpdate: () => {
                el.textContent = Math.round(state.value).toLocaleString('en-US');
              },
              onComplete: () => {
                el.textContent = finalText;
              },
            });
          }
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
