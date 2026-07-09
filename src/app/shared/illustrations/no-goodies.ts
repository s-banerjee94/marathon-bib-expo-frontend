import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-goodies',
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
        <rect x="30" y="46" width="60" height="12" rx="2" />
        <rect x="35" y="58" width="50" height="32" rx="2" />
        <path d="M60 48 V90" />
        <path d="M60 46 C51 37 43 41 47 47 C50 50 56 49 60 46 Z" />
        <path d="M60 46 C69 37 77 41 73 47 C70 50 64 49 60 46 Z" />
        <circle cx="60" cy="46" r="2" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M92 40 C92 42.7 93.28 44 96 44 C93.28 44 92 45.3 92 48 C92 45.3 90.72 44 88 44 C90.72 44 92 42.7 92 40 Z"
        />
      </svg>
    </span>
  `,
})
export class NoGoodies {
  readonly size = input(96);
}
