import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-notifications',
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
        <circle cx="60" cy="34" r="3" />
        <path d="M44 80 C44 62 47 48 60 48 C73 48 76 62 76 80" />
        <path d="M40 80 Q60 86 80 80" />
        <circle cx="60" cy="87" r="3.5" />
        <polyline
          class="motion-safe:animate-illustration-twinkle"
          points="80 42 86 42 80 48 86 48"
          opacity="0.5"
        />
        <polyline
          class="motion-safe:animate-illustration-twinkle"
          points="90 30 97 30 90 37 97 37"
          opacity="0.5"
        />
      </svg>
    </span>
  `,
})
export class NoNotifications {
  readonly size = input(96);
}
