import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import gsap from 'gsap';

/** 3D-tilts the element toward the cursor while hovered (fine pointers only). */
@Directive({
  selector: '[appTiltCard]',
})
export class TiltCard {
  readonly tiltMax = input(8, { transform: numberAttribute });

  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference) and (pointer: fine)', () => {
          const rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power2' });
          const ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power2' });

          // Re-applied on every enter: a ScrollReveal on the same element clears
          // inline transforms (and GSAP's cache with them) when its tween completes.
          const onEnter = (): void => {
            gsap.set(el, { transformPerspective: 900 });
          };
          const onMove = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') {
              return;
            }
            const rect = el.getBoundingClientRect();
            const dx = (event.clientX - rect.left) / rect.width - 0.5;
            const dy = (event.clientY - rect.top) / rect.height - 0.5;
            ryTo(dx * this.tiltMax() * 2);
            rxTo(-dy * this.tiltMax() * 2);
          };
          const onLeave = (): void => {
            rxTo(0);
            ryTo(0);
          };

          el.addEventListener('pointerenter', onEnter);
          el.addEventListener('pointermove', onMove);
          el.addEventListener('pointerleave', onLeave);
          return () => {
            el.removeEventListener('pointerenter', onEnter);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
          };
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
