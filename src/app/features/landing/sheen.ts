import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Glare bar that sweeps across its parent card: once when the card scrolls into
 * view, and again on every hover. Put it on an absolutely-positioned gradient
 * strip parked off-card via a translate class, inside an overflow-hidden parent —
 * under reduced motion it simply never moves into frame.
 */
@Directive({
  selector: '[appSheen]',
})
export class Sheen {
  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        const parent = el.parentElement;
        if (!parent) {
          return;
        }
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const sweep = (): void => {
            gsap.fromTo(
              el,
              { xPercent: -220, rotation: 12 },
              { xPercent: 420, rotation: 12, duration: 1.1, ease: 'power2.inOut', overwrite: true },
            );
          };
          const st = ScrollTrigger.create({
            trigger: parent,
            start: 'top 75%',
            once: true,
            onEnter: sweep,
          });
          const onEnter = (event: PointerEvent): void => {
            if (event.pointerType !== 'touch') {
              sweep();
            }
          };
          parent.addEventListener('pointerenter', onEnter);
          return () => {
            st.kill();
            parent.removeEventListener('pointerenter', onEnter);
          };
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
