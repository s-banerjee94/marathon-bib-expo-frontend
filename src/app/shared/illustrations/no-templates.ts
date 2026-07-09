import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-templates',
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
          d="M36 30 H84 a8 8 0 0 1 8 8 V62 a8 8 0 0 1 -8 8 H52 L42 82 V70 H36 a8 8 0 0 1 -8 -8 V38 a8 8 0 0 1 8 -8 Z"
        />
        <path d="M44 44 H78" opacity="0.55" />
        <path d="M44 52 H70" opacity="0.55" />
        <rect x="44" y="58" width="30" height="8" rx="4" stroke-dasharray="3 4" opacity="0.5" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M100 24 C100 26.7 101.28 28 104 28 C101.28 28 100 29.3 100 32 C100 29.3 98.72 28 96 28 C98.72 28 100 26.7 100 24 Z"
        />
      </svg>
    </span>
  `,
})
export class NoTemplates {
  readonly size = input(96);
}
