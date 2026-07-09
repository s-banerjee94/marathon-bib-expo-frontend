import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-import-failed',
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
          d="M36 20 H58 L72 34 V78 a5 5 0 0 1 -5 5 H41 a5 5 0 0 1 -5 -5 V25 a5 5 0 0 1 5 -5 Z"
        />
        <path d="M58 20 V34 H72" />
        <path d="M44 47 H64" opacity="0.55" />
        <path d="M44 56 H64" opacity="0.55" />
        <path d="M44 65 H56" opacity="0.55" />
        <path d="M84 60 L98 86 H70 Z" />
        <path d="M84 69 V77" />
        <circle cx="84" cy="81.5" r="0.6" />
      </svg>
    </span>
  `,
})
export class ImportFailed {
  readonly size = input(96);
}
