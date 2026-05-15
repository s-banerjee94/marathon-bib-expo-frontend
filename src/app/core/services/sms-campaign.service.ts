import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SmsCampaign,
  CreateSmsCampaignRequest,
  UpdateSmsCampaignRequest,
} from '../models/sms-campaign.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class SmsCampaignService {
  private http = inject(HttpClient);

  getCampaignsByEvent(eventId: number): Observable<SmsCampaign[]> {
    return this.http.get<SmsCampaign[]>(`${BASE_URI}/events/${eventId}/sms-campaigns`);
  }

  getCampaignById(eventId: number, campaignId: number): Observable<SmsCampaign> {
    return this.http.get<SmsCampaign>(`${BASE_URI}/events/${eventId}/sms-campaigns/${campaignId}`);
  }

  createCampaign(eventId: number, request: CreateSmsCampaignRequest): Observable<SmsCampaign> {
    return this.http.post<SmsCampaign>(`${BASE_URI}/events/${eventId}/sms-campaigns`, request);
  }

  updateCampaign(
    eventId: number,
    campaignId: number,
    request: UpdateSmsCampaignRequest,
  ): Observable<SmsCampaign> {
    return this.http.patch<SmsCampaign>(
      `${BASE_URI}/events/${eventId}/sms-campaigns/${campaignId}`,
      request,
    );
  }

  deleteCampaign(eventId: number, campaignId: number): Observable<void> {
    return this.http.delete<void>(`${BASE_URI}/events/${eventId}/sms-campaigns/${campaignId}`);
  }

  disarmCampaign(eventId: number, campaignId: number): Observable<SmsCampaign> {
    return this.http.patch<SmsCampaign>(
      `${BASE_URI}/events/${eventId}/sms-campaigns/${campaignId}/disarm`,
      {},
    );
  }
}
