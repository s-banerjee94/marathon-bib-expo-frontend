import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 600 600"
        fill="none"
        role="img"
        aria-label="Access denied"
        class="w-72 md:w-[28rem] mb-6 select-none"
      >
        <circle cx="300" cy="300" r="270" fill="var(--be-primary-50)" />
        <circle
          cx="300"
          cy="300"
          r="252"
          fill="none"
          stroke="var(--be-primary-300)"
          stroke-width="3"
          stroke-dasharray="8 14"
          opacity="0.55"
        />
        <ellipse cx="300" cy="500" rx="200" ry="10" fill="var(--be-text-color)" opacity="0.08" />

        <!-- shield -->
        <g transform="translate(300 305)">
          <path
            d="M 0,-160 L 130,-110 L 130,40 Q 130,130 0,170 Q -130,130 -130,40 L -130,-110 Z"
            fill="var(--be-primary-500)"
            stroke="var(--be-primary-800)"
            stroke-width="3"
            stroke-linejoin="round"
          />
          <path
            d="M 0,-145 L 115,-100 L 115,35 Q 115,115 0,150 Q -115,115 -115,35 L -115,-100 Z"
            fill="none"
            stroke="var(--be-primary-300)"
            stroke-width="2"
            opacity="0.6"
          />
        </g>

        <!-- padlock -->
        <g transform="translate(300 320)">
          <path
            d="M -34,-30 L -34,-55 Q -34,-90 0,-90 Q 34,-90 34,-55 L 34,-30"
            fill="none"
            stroke="var(--be-surface-50)"
            stroke-width="14"
            stroke-linecap="round"
          />
          <rect
            x="-55"
            y="-30"
            width="110"
            height="90"
            rx="12"
            fill="var(--be-surface-50)"
            stroke="var(--be-surface-300)"
            stroke-width="2"
          />
          <circle cx="0" cy="5" r="10" fill="#ef4444" />
          <rect x="-3" y="5" width="6" height="22" rx="2" fill="#ef4444" />
        </g>

        <!-- 403 bib -->
        <g transform="rotate(-15 130 200)" opacity="0.9">
          <rect
            x="80"
            y="160"
            width="100"
            height="80"
            rx="6"
            fill="var(--be-surface-0)"
            stroke="var(--be-surface-300)"
            stroke-width="2"
          />
          <rect x="80" y="160" width="100" height="14" rx="6" fill="#ef4444" />
          <rect x="80" y="170" width="100" height="4" fill="#ef4444" />
          <text
            x="130"
            y="216"
            text-anchor="middle"
            font-family="Inter, ui-sans-serif, system-ui, sans-serif"
            font-size="28"
            font-weight="800"
            fill="#000000"
          >
            403
          </text>
        </g>

        <!-- no entry symbol -->
        <g transform="translate(475 175)">
          <circle cx="0" cy="0" r="30" fill="#ef4444" />
          <rect x="-18" y="-4" width="36" height="8" rx="2" fill="var(--be-surface-0)" />
        </g>

        <!-- decorative dots -->
        <g fill="var(--be-primary-300)">
          <circle cx="80" cy="340" r="5" />
          <circle cx="110" cy="440" r="4" />
          <circle cx="520" cy="440" r="5" />
          <circle cx="540" cy="320" r="4" />
          <circle cx="60" cy="260" r="3" />
        </g>
      </svg>
      <p class="text-xl font-semibold mb-2">Access Denied</p>
      <p class="mb-6">You do not have permission to access this page.</p>
      <a pButton routerLink="/dashboard">
        <i class="pi pi-home" pButtonIcon></i>
        <span pButtonLabel>Return to Dashboard</span>
      </a>
    </div>
  `,
})
export class Unauthorized {}
