import { DestroyRef, Directive, ElementRef, NgZone, inject } from '@angular/core';
import gsap from 'gsap';

function pick<T>(items: readonly T[]): T {
  return items[gsap.utils.random(0, items.length - 1, 1)];
}

/** Random exit: tossed left/right with an arc, spun down, skated off, or tipped over. */
function buildExit(el: HTMLElement): gsap.TweenVars {
  const rect = el.getBoundingClientRect();
  const offRight = window.innerWidth - rect.left + 120;
  const offLeft = -(rect.right + 120);
  const offDown = window.innerHeight - rect.top + 120;
  const side = gsap.utils.random(0, 1, 1) === 0 ? offLeft : offRight;
  const spin = side > 0 ? 1 : -1;
  return pick<gsap.TweenVars>([
    {
      keyframes: [
        { y: -36, rotation: -6 * spin, duration: 0.16, ease: 'power2.out' },
        {
          x: side,
          y: 140,
          rotation: spin * gsap.utils.random(25, 50),
          duration: 0.55,
          ease: 'power1.in',
        },
      ],
    },
    {
      y: offDown,
      rotation: spin * gsap.utils.random(160, 340),
      scale: 0.6,
      duration: 0.7,
      ease: 'power2.in',
    },
    { x: side, rotation: 12 * spin, duration: 0.5, ease: 'power3.in' },
    {
      rotationX: -80,
      transformPerspective: 900,
      transformOrigin: 'center bottom',
      y: offDown,
      opacity: 0.4,
      duration: 0.65,
      ease: 'power2.in',
    },
  ]);
}

/** Random entrance, always dropping in from above the viewport. */
function buildEntrance(el: HTMLElement): { from: gsap.TweenVars; to: gsap.TweenVars } {
  const rect = el.getBoundingClientRect();
  const fromY = -(rect.top + rect.height + 80);
  return pick([
    {
      from: { y: fromY, rotation: gsap.utils.random(-7, 7) },
      to: { duration: 0.9, ease: 'bounce.out' },
    },
    {
      from: { y: fromY, rotation: gsap.utils.random(-16, 16) },
      to: { duration: 1.1, ease: 'elastic.out(1, 0.6)' },
    },
    {
      from: { y: fromY, scale: 0.88 },
      to: { duration: 0.7, ease: 'back.out(1.6)' },
    },
  ]);
}

/**
 * Card swap animation: flies the host offscreen (random direction and style,
 * different every time), applies the content swap, then drops the host back in
 * from the top. Grab it with `viewChild.required(CardFly)` and await
 * `swap(() => …update state…)` — it resolves once the entrance settles.
 * Under prefers-reduced-motion the swap applies instantly with no animation.
 */
@Directive({
  selector: '[appCardFly]',
})
export class CardFly {
  private readonly el = inject(ElementRef).nativeElement as HTMLElement;
  private readonly zone = inject(NgZone);
  private busy = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => gsap.killTweensOf(this.el));
  }

  swap(applyChanges: () => void): Promise<void> {
    if (this.busy || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyChanges();
      return Promise.resolve();
    }
    this.busy = true;
    // A finished CSS entrance animation with fill-mode keeps overriding inline
    // transforms, which would pin the card in place — neutralize it first.
    this.el.style.animation = 'none';
    return new Promise((resolve) => {
      this.zone.runOutsideAngular(() => {
        gsap.to(this.el, {
          ...buildExit(this.el),
          overwrite: true,
          onComplete: () => {
            gsap.set(this.el, { clearProps: 'transform,opacity' });
            this.zone.run(applyChanges);
            const { from, to } = buildEntrance(this.el);
            gsap.fromTo(this.el, from, {
              y: 0,
              rotation: 0,
              scale: 1,
              opacity: 1,
              ...to,
              clearProps: 'transform,opacity',
              onComplete: () => {
                this.busy = false;
                this.zone.run(resolve);
              },
            });
          },
        });
      });
    });
  }
}
