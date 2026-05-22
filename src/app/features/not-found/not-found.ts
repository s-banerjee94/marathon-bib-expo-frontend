import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 600 600"
        fill="none"
        role="img"
        aria-label="Page not found"
        class="w-72 md:w-[28rem] mb-6 select-none"
      >
        <circle cx="300" cy="300" r="270" fill="var(--p-primary-50)" />
        <circle
          cx="300"
          cy="300"
          r="252"
          fill="none"
          stroke="var(--p-primary-300)"
          stroke-width="3"
          stroke-dasharray="8 14"
          opacity="0.55"
        />
        <ellipse cx="300" cy="500" rx="220" ry="10" fill="var(--p-text-color)" opacity="0.08" />

        <!-- signpost -->
        <rect x="392" y="180" width="14" height="300" rx="3" fill="var(--p-surface-600)" />
        <ellipse cx="399" cy="490" rx="22" ry="5" fill="var(--p-text-color)" opacity="0.15" />

        <!-- THIS WAY arrow -->
        <polygon points="280,205 415,205 440,225 415,245 280,245" fill="var(--p-primary-600)" />
        <polygon points="280,205 280,245 270,225" fill="var(--p-primary-800)" />
        <text
          x="345"
          y="231"
          text-anchor="middle"
          font-family="Inter, ui-sans-serif, system-ui, sans-serif"
          font-size="16"
          font-weight="700"
          fill="var(--p-surface-0)"
          letter-spacing="2"
        >
          THIS WAY
        </text>

        <!-- NOT FOUND arrow -->
        <polygon points="320,275 455,275 455,315 320,315 295,295" fill="#ef4444" />
        <polygon points="455,275 465,295 455,315" fill="#b91c1c" />
        <text
          x="392"
          y="301"
          text-anchor="middle"
          font-family="Inter, ui-sans-serif, system-ui, sans-serif"
          font-size="16"
          font-weight="700"
          fill="var(--p-surface-0)"
          letter-spacing="2"
        >
          NOT FOUND
        </text>

        <!-- tilted race bib with 404 -->
        <g transform="rotate(-12 200 360)">
          <circle cx="120" cy="240" r="7" fill="var(--p-surface-400)" />
          <circle cx="280" cy="240" r="7" fill="var(--p-surface-400)" />
          <rect
            x="85"
            y="240"
            width="230"
            height="200"
            rx="12"
            fill="var(--p-surface-0)"
            stroke="var(--p-surface-300)"
            stroke-width="2.5"
          />
          <rect x="85" y="240" width="230" height="28" rx="12" fill="#f97316" />
          <rect x="85" y="260" width="230" height="8" fill="#f97316" />
          <text
            x="200"
            y="370"
            text-anchor="middle"
            font-family="Inter, ui-sans-serif, system-ui, sans-serif"
            font-size="92"
            font-weight="800"
            fill="#000000"
            letter-spacing="-3"
          >
            404
          </text>
          <text
            x="200"
            y="410"
            text-anchor="middle"
            font-family="Inter, ui-sans-serif, system-ui, sans-serif"
            font-size="13"
            font-weight="600"
            fill="var(--p-text-muted-color)"
            letter-spacing="4"
          >
            PAGE LOST
          </text>
        </g>

        <!-- floating question marks -->
        <g fill="var(--p-primary-600)">
          <text x="490" y="160" font-family="Inter, sans-serif" font-size="36" font-weight="800">
            ?
          </text>
          <text
            x="120"
            y="180"
            font-family="Inter, sans-serif"
            font-size="26"
            font-weight="800"
            opacity="0.6"
          >
            ?
          </text>
          <text
            x="510"
            y="380"
            font-family="Inter, sans-serif"
            font-size="22"
            font-weight="800"
            opacity="0.5"
          >
            ?
          </text>
        </g>

        <!-- decorative dots -->
        <g fill="var(--p-primary-300)">
          <circle cx="80" cy="320" r="5" />
          <circle cx="100" cy="430" r="4" />
          <circle cx="520" cy="450" r="5" />
          <circle cx="540" cy="280" r="4" />
          <circle cx="60" cy="260" r="3" />
        </g>
      </svg>
      <p class="text-xl font-semibold mb-2">Oops! This page ran away.</p>
      <p class="mb-6">The page you're looking for doesn't exist or has been moved.</p>
      <a pButton routerLink="/dashboard">
        <i class="pi pi-home" pButtonIcon></i>
        <span pButtonLabel>Back to Dashboard</span>
      </a>
    </div>
  `,
})
export class NotFound {}
