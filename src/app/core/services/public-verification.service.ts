import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PUBLIC_BASE_URI } from '../../shared/constants/api.constant';
import { ParticipantVerificationResponse } from '../models/participant-verification.model';

// Public, no-auth access to a participant's verification details by short code.
// Backend: GET /s/{shortCode} (lives at the host root, outside /api).
@Injectable({ providedIn: 'root' })
export class PublicVerificationService {
  private http = inject(HttpClient);

  resolveShortUrl(shortCode: string): Observable<ParticipantVerificationResponse> {
    return this.http.get<ParticipantVerificationResponse>(
      `${PUBLIC_BASE_URI}/s/${encodeURIComponent(shortCode)}`,
    );
  }
}
