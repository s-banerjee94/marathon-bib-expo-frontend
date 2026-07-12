import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import gsap from 'gsap';

/**
 * Smooth expand/collapse for a native `<details>` FAQ item. Opening animates the
 * `[data-faq-body]` child in after the native toggle; closing intercepts the
 * summary click, plays the collapse, then closes for real. Reduced motion keeps
 * the instant native behavior.
 */
@Directive({
  selector: 'details[appFaqReveal]',
})
export class FaqReveal {
  constructor() {
    const details = inject(ElementRef).nativeElement as HTMLDetailsElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        const summary = details.querySelector('summary');
        const body = details.querySelector<HTMLElement>('[data-faq-body]');
        if (!summary || !body) {
          return;
        }
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const marginTop = parseFloat(getComputedStyle(body).marginTop) || 0;
          let closing = false;

          const onToggle = (): void => {
            if (details.open && !closing) {
              gsap.fromTo(
                body,
                { height: 0, marginTop: 0, opacity: 0, overflow: 'hidden' },
                {
                  height: 'auto',
                  marginTop,
                  opacity: 1,
                  duration: 0.35,
                  ease: 'power2.out',
                  overwrite: true,
                  clearProps: 'all',
                },
              );
            }
          };
          const onClick = (event: MouseEvent): void => {
            if (!details.open) {
              return;
            }
            event.preventDefault();
            if (closing) {
              return;
            }
            closing = true;
            gsap.to(body, {
              height: 0,
              marginTop: 0,
              opacity: 0,
              overflow: 'hidden',
              duration: 0.3,
              ease: 'power2.in',
              overwrite: true,
              onComplete: () => {
                details.open = false;
                closing = false;
                gsap.set(body, { clearProps: 'all' });
              },
            });
          };

          details.addEventListener('toggle', onToggle);
          summary.addEventListener('click', onClick);
          return () => {
            details.removeEventListener('toggle', onToggle);
            summary.removeEventListener('click', onClick);
          };
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
