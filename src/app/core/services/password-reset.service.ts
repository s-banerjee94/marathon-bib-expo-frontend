import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import { ForgotPasswordRequest, PasswordResetTokenStatus } from '../models/password-reset.model';

/**
 * Public (no-auth) half of the password-reset flow: requesting a link while
 * logged out, and validating/consuming the token the link carries. Issuing a
 * link as an admin lives on UserService.issueResetLink.
 */
@Injectable({
  providedIn: 'root',
})
export class PasswordResetService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/auth/password-reset`;

  /**
   * Request a reset link for a username/email/phone. The backend always
   * responds 200 so account existence is never revealed.
   */
  requestResetLink(request: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot`, request);
  }

  /** Validate a reset token; 404 means invalid, expired, or already used. */
  validateToken(token: string): Observable<PasswordResetTokenStatus> {
    return this.http.get<PasswordResetTokenStatus>(`${this.apiUrl}/${encodeURIComponent(token)}`);
  }

  /** Set the new password. Tokens are single-use; 404 means expired or used. */
  completeReset(token: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${encodeURIComponent(token)}`, { newPassword });
  }
}
