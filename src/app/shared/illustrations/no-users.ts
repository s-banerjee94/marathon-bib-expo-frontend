import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-users',
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
        <circle cx="74" cy="52" r="7" opacity="0.55" />
        <path d="M62 88 C62 74 86 74 86 88" opacity="0.55" />
        <circle cx="48" cy="48" r="9" />
        <path d="M32 90 C32 71 64 71 64 90" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M92 30 C92 32.7 93.28 34 96 34 C93.28 34 92 35.3 92 38 C92 35.3 90.72 34 88 34 C90.72 34 92 32.7 92 30 Z"
        />
      </svg>
    </span>
  `,
})
export class NoUsers {
  readonly size = input(96);
}
