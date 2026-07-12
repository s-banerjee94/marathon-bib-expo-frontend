import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import gsap from 'gsap';

/**
 * Cursor-following highlight for the dark bands. Put it on an absolutely
 * positioned overlay whose radial-gradient background reads --spot-x/--spot-y;
 * the directive tracks the pointer over the parent section and fades the
 * overlay in and out. Fine pointers only — touch and reduced motion see nothing.
 */
@Directive({
  selector: '[appSpotlight]',
})
export class Spotlight {
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
        mm.add('(prefers-reduced-motion: no-preference) and (pointer: fine)', () => {
          const onMove = (event: PointerEvent): void => {
            const rect = parent.getBoundingClientRect();
            el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
            el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
            el.style.opacity = '1';
          };
          const onLeave = (): void => {
            el.style.opacity = '0';
          };
          parent.addEventListener('pointermove', onMove);
          parent.addEventListener('pointerleave', onLeave);
          return () => {
            parent.removeEventListener('pointermove', onMove);
            parent.removeEventListener('pointerleave', onLeave);
          };
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
