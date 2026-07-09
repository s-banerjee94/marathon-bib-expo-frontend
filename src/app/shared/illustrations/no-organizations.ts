import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-illustration-no-organizations',
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
        <path d="M43 34 H77 a3 3 0 0 1 3 3 V90 H40 V37 a3 3 0 0 1 3 -3 Z" />
        <path d="M34 92 H86" />
        <rect x="47" y="44" width="9" height="9" rx="1" />
        <rect x="63" y="44" width="9" height="9" rx="1" />
        <rect x="47" y="58" width="9" height="9" rx="1" />
        <rect x="63" y="58" width="9" height="9" rx="1" />
        <path d="M55 90 V76 a5 5 0 0 1 10 0 V90" />
        <path d="M60 34 V24" />
        <path d="M60 24 L71 27 L60 31" opacity="0.6" />
        <path
          class="motion-safe:animate-illustration-twinkle"
          opacity="0.5"
          d="M90 39.5 C90 42.6 91.44 44 94.5 44 C91.44 44 90 45.4 90 48.5 C90 45.4 88.56 44 85.5 44 C88.56 44 90 42.6 90 39.5 Z"
        />
      </svg>
    </span>
  `,
})
export class NoOrganizations {
  readonly size = input(96);
}
