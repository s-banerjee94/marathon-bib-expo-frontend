import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import gsap from 'gsap';

/** Pulls the element gently toward the cursor while hovered (fine pointers only). */
@Directive({
  selector: '[appMagnetic]',
})
export class Magnetic {
  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference) and (pointer: fine)', () => {
          const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
          const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });

          const onMove = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') {
              return;
            }
            const rect = el.getBoundingClientRect();
            xTo((event.clientX - rect.left - rect.width / 2) * 0.25);
            yTo((event.clientY - rect.top - rect.height / 2) * 0.35);
          };
          const onLeave = (): void => {
            xTo(0);
            yTo(0);
          };

          el.addEventListener('pointermove', onMove);
          el.addEventListener('pointerleave', onLeave);
          return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
          };
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
