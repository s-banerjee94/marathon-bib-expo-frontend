import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-search-results',
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
        <circle cx="52" cy="50" r="24" />
        <path d="M70 68 L88 86" stroke-width="2.6" />
        <circle cx="45" cy="52" r="1.6" opacity="0.6" />
        <circle cx="52" cy="52" r="1.6" opacity="0.6" />
        <circle cx="59" cy="52" r="1.6" opacity="0.6" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M90 34 C90 36.7 91.28 38 94 38 C91.28 38 90 39.3 90 42 C90 39.3 88.72 38 86 38 C88.72 38 90 36.7 90 34 Z"
        />
      </svg>
    </span>
  `,
})
export class NoSearchResults {
  readonly size = input(96);
}
