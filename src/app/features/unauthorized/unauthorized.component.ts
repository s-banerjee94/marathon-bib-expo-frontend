import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div
      style="text-align: center; padding: 2rem; min-height: 100vh; display: flex; flex-direction: column; justify-content: center;"
    >
      <h1>Access Denied</h1>
      <p>You do not have permission to access this page.</p>
      <a routerLink="/dashboard" style="color: #667eea; text-decoration: none; font-weight: 600;">
        Return to Dashboard
      </a>
    </div>
  `,
})
export class UnauthorizedComponent {}
