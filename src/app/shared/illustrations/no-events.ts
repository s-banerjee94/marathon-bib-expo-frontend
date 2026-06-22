import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-events',
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
        <rect x="24" y="32" width="72" height="64" rx="8" />
        <path d="M24 50 H96" />
        <path d="M42 24 V38" />
        <path d="M78 24 V38" />
        <rect x="44" y="60" width="32" height="24" rx="4" stroke-dasharray="3 5" opacity="0.55" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M96 23 C96 26.4 97.6 28 101 28 C97.6 28 96 29.6 96 33 C96 29.6 94.4 28 91 28 C94.4 28 96 26.4 96 23 Z"
        />
      </svg>
    </span>
  `,
})
export class NoEvents {
  readonly size = input(96);
}
