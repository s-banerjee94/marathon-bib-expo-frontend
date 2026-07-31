import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import {
  MessagingChannel,
  MessagingProviderResponse,
  SaveMessagingProviderRequest,
} from '../models/system-messaging.model';
import { CampaignProviderScope, ProviderTestSendRequest } from '../models/campaign-provider.model';

// Campaign sender provider config at two scopes: the platform default (ROOT, under
// /system) and a per-organization override (ROOT/ADMIN/ORGANIZER_ADMIN, under the org).
// get-by-channel 404s when the channel is not configured — callers treat that as an
// empty form. The org override DELETE falls back to the platform default.
@Injectable({
  providedIn: 'root',
})
export class CampaignProviderService {
  private http = inject(HttpClient);

  private baseUrl(scope: CampaignProviderScope): string {
    return scope.kind === 'SYSTEM'
      ? `${BASE_URI}/system/campaign-providers`
      : `${BASE_URI}/organizations/${scope.organizationId}/campaign-providers`;
  }

  list(scope: CampaignProviderScope): Observable<MessagingProviderResponse[]> {
    return this.http.get<MessagingProviderResponse[]>(this.baseUrl(scope));
  }

  get(
    scope: CampaignProviderScope,
    channel: MessagingChannel,
  ): Observable<MessagingProviderResponse> {
    return this.http.get<MessagingProviderResponse>(`${this.baseUrl(scope)}/${channel}`);
  }

  // Switching a sender off (or deleting it) 409s while campaigns are still armed.
  // Only the platform sender takes `force` — an organization owns both sides, so it is
  // expected to disarm first. Never pass force without asking the user.
  private forceParams(scope: CampaignProviderScope, force?: boolean): { params?: HttpParams } {
    return force && scope.kind === 'SYSTEM' ? { params: new HttpParams().set('force', true) } : {};
  }

  save(
    scope: CampaignProviderScope,
    channel: MessagingChannel,
    request: SaveMessagingProviderRequest,
    force?: boolean,
  ): Observable<MessagingProviderResponse> {
    return this.http.put<MessagingProviderResponse>(
      `${this.baseUrl(scope)}/${channel}`,
      request,
      this.forceParams(scope, force),
    );
  }

  remove(
    scope: CampaignProviderScope,
    channel: MessagingChannel,
    force?: boolean,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl(scope)}/${channel}`,
      this.forceParams(scope, force),
    );
  }

  // 200 = provider call succeeded; 502 = provider call failed (surface to the user).
  test(
    scope: CampaignProviderScope,
    channel: MessagingChannel,
    request: ProviderTestSendRequest,
  ): Observable<void> {
    return this.http.post<void>(`${this.baseUrl(scope)}/${channel}/test`, request);
  }
}
