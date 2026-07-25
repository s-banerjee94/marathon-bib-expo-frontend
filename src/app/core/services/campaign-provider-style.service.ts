import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CampaignProviderStyle, MessagingChannel } from '../models/campaign-provider-style.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class CampaignProviderStyleService {
  private http = inject(HttpClient);

  // Resolves the rendering style of the provider that will send campaigns for this
  // event's organization on the given channel. A 200 with `hasProvider: false` means
  // no provider is configured yet; a 404 means the event is not found/visible.
  getStyle(eventId: number, channel: MessagingChannel): Observable<CampaignProviderStyle> {
    const params = new HttpParams().set('channel', channel);
    return this.http.get<CampaignProviderStyle>(
      `${BASE_URI}/events/${eventId}/campaign-provider-style`,
      { params },
    );
  }
}
