import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-all-caught-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex motion-safe:animate-illustration-fade-in">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 120 120"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="text-color-secondary motion-safe:animate-illustration-float"
      >
        <path d="M28 60 H44 L50 72 H70 L76 60 H92 V86 a4 4 0 0 1 -4 4 H32 a4 4 0 0 1 -4 -4 Z" />
        <polyline points="50 44 58 52 74 34" stroke-width="2.4" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M40 29.5 C40 32.6 41.44 34 44.5 34 C41.44 34 40 35.4 40 38.5 C40 35.4 38.56 34 35.5 34 C38.56 34 40 32.6 40 29.5 Z"
        />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M86 44.5 C86 46.9 87.12 48 89.5 48 C87.12 48 86 49.1 86 51.5 C86 49.1 84.88 48 82.5 48 C84.88 48 86 46.9 86 44.5 Z"
        />
      </svg>
    </span>
  `,
})
export class AllCaughtUp {
  readonly size = input(96);
}
