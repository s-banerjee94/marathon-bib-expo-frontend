import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-data',
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
        <path
          d="M28 48 a3 3 0 0 1 3 -3 H46 a3 3 0 0 1 2.2 1 L52 50 H89 a3 3 0 0 1 3 3 V85 a3 3 0 0 1 -3 3 H31 a3 3 0 0 1 -3 -3 Z"
        />
        <path d="M44 64 H76" stroke-dasharray="3 5" opacity="0.5" />
        <path d="M44 73 H66" stroke-dasharray="3 5" opacity="0.5" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M92 36 C92 38.7 93.28 40 96 40 C93.28 40 92 41.3 92 44 C92 41.3 90.72 40 88 40 C90.72 40 92 38.7 92 36 Z"
        />
      </svg>
    </span>
  `,
})
export class NoData {
  readonly size = input(96);
}
