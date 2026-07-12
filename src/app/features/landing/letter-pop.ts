import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import gsap from 'gsap';

/** Splits words into per-letter spans; inline-block words keep normal wrapping. */
function splitIntoLetters(el: HTMLElement): void {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) {
      continue;
    }
    const frag = document.createDocumentFragment();
    for (const part of (node.textContent ?? '').split(/(\s+)/)) {
      if (!part) {
        continue;
      }
      if (/^\s+$/.test(part)) {
        frag.append(' ');
        continue;
      }
      const word = document.createElement('span');
      word.className = 'inline-block whitespace-nowrap';
      for (const ch of Array.from(part)) {
        const char = document.createElement('span');
        char.className = 'inline-block';
        char.dataset['popChar'] = 'true';
        char.textContent = ch;
        word.append(char);
      }
      frag.append(word);
    }
    node.replaceWith(frag);
  }
}

function pop(char: HTMLElement): void {
  gsap.to(char, {
    keyframes: [
      { y: '-0.14em', scaleY: 1.08, duration: 0.16, ease: 'power2.out' },
      { y: 0, scaleY: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.4)' },
    ],
    overwrite: true,
  });
}

/**
 * Splits the element's text into letters that pop up and spring back when the
 * pointer passes over them — mouse hover, or a finger dragged across on touch
 * screens. Only top-level text nodes are split, so nested elements (<br>, spans
 * with their own behavior) are left alone. Since split text reads
 * letter-by-letter to screen readers, the original text is exposed via
 * aria-label — override with `popLabel` when the element contains extra
 * sr-only content.
 */
@Directive({
  selector: '[appLetterPop]',
})
export class LetterPop {
  readonly popLabel = input('');

  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    const zone = inject(NgZone);
    let mm: gsap.MatchMedia | undefined;

    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          if (!el.dataset['split']) {
            const label = this.popLabel() || (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            el.setAttribute('aria-label', label);
            splitIntoLetters(el);
            el.dataset['split'] = 'true';
          }

          const chars = Array.from(el.querySelectorAll<HTMLElement>('[data-pop-char]'));
          const handlers = chars.map((char) => {
            const onEnter = (event: PointerEvent): void => {
              if (event.pointerType === 'touch') {
                return;
              }
              pop(char);
            };
            char.addEventListener('pointerenter', onEnter);
            return { char, onEnter };
          });

          // Touch: the first letter touched implicitly captures the pointer, so
          // per-letter pointerenter never fires while a finger drags across the
          // text — hit-test the finger position instead. Passive listeners keep
          // page scrolling untouched.
          let lastChar: HTMLElement | null = null;
          const popAt = (touch: Touch): void => {
            const hit = document
              .elementFromPoint(touch.clientX, touch.clientY)
              ?.closest<HTMLElement>('[data-pop-char]');
            if (hit && el.contains(hit) && hit !== lastChar) {
              lastChar = hit;
              pop(hit);
            }
          };
          const onTouchStart = (event: TouchEvent): void => popAt(event.touches[0]);
          const onTouchMove = (event: TouchEvent): void => popAt(event.touches[0]);
          const onTouchEnd = (): void => {
            lastChar = null;
          };
          el.addEventListener('touchstart', onTouchStart, { passive: true });
          el.addEventListener('touchmove', onTouchMove, { passive: true });
          el.addEventListener('touchend', onTouchEnd, { passive: true });

          return () => {
            for (const { char, onEnter } of handlers) {
              char.removeEventListener('pointerenter', onEnter);
            }
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
          };
        });
      });
    });

    inject(DestroyRef).onDestroy(() => mm?.revert());
  }
}
