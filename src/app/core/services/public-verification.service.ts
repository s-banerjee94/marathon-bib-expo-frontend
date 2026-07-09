import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import { ParticipantVerificationResponse } from '../models/participant-verification.model';

// Public, no-auth access to a participant's verification details by short code.
// Backend: GET /api/public/short-links/{shortCode}. The user-facing short URL
// (/s/{shortCode}) is the SPA page, which calls this to resolve the code.
@Injectable({ providedIn: 'root' })
export class PublicVerificationService {
  private http = inject(HttpClient);

  resolveShortUrl(shortCode: string): Observable<ParticipantVerificationResponse> {
    return this.http.get<ParticipantVerificationResponse>(
      `${BASE_URI}/public/short-links/${encodeURIComponent(shortCode)}`,
    );
  }
}
