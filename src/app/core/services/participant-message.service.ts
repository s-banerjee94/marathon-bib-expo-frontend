import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ParticipantMessagesResponse,
  SendParticipantMessagesRequest,
} from '../models/participant-message.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class ParticipantMessageService {
  private http = inject(HttpClient);

  // Messages go out while the request is open, so this can take a few seconds.
  sendToParticipants(
    eventId: number,
    request: SendParticipantMessagesRequest,
  ): Observable<ParticipantMessagesResponse> {
    return this.http.post<ParticipantMessagesResponse>(
      `${BASE_URI}/events/${eventId}/participant-messages`,
      request,
    );
  }
}
