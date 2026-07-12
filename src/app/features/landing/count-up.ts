import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Counts the element's numeric text up from 0 when it scrolls into view.
 * The target value (thousands separators allowed) is read from the DOM, so the
 * template stays the single source of truth and reduced-motion just shows it.
 */
@Directive({
  selector: '[appCountUp]',
})
export class CountUp {
  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const finalText = el.textContent ?? '';
          const target = Number(finalText.replaceAll(',', ''));
          if (!Number.isFinite(target)) {
            return;
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
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
