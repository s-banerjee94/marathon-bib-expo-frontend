import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-campaigns',
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
        <rect x="30" y="54" width="10" height="14" rx="2" />
        <path d="M40 54 L66 40 V82 L40 68 Z" />
        <path d="M35 68 V80" />
        <path d="M74 48 a16 16 0 0 1 0 26" opacity="0.5" />
        <path d="M80 43 a22 22 0 0 1 0 36" opacity="0.5" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M46 30 C46 32.7 47.28 34 50 34 C47.28 34 46 35.3 46 38 C46 35.3 44.72 34 42 34 C44.72 34 46 32.7 46 30 Z"
        />
      </svg>
    </span>
  `,
})
export class NoCampaigns {
  readonly size = input(96);
}
