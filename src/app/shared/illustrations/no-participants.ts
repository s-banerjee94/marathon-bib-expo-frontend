import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-participants',
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
        <rect x="26" y="32" width="68" height="60" rx="6" />
        <circle cx="40" cy="44" r="2.4" />
        <circle cx="80" cy="44" r="2.4" />
        <circle cx="60" cy="60" r="7" />
        <path d="M46 84 C46 72 74 72 74 84" />
        <path d="M48 44 H72" opacity="0.45" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M100 26 C100 29.4 101.6 31 105 31 C101.6 31 100 32.6 100 36 C100 32.6 98.4 31 95 31 C98.4 31 100 29.4 100 26 Z"
        />
      </svg>
    </span>
  `,
})
export class NoParticipants {
  readonly size = input(96);
}
