import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateWhatsAppTemplateRequest,
  UpdateWhatsAppTemplateRequest,
  WhatsAppTemplate,
} from '../models/whatsapp-template.model';
import {
  CreateWhatsAppCampaignRequest,
  UpdateWhatsAppCampaignRequest,
  WhatsAppCampaign,
} from '../models/whatsapp-campaign.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class WhatsAppService {
  private http = inject(HttpClient);

  private templatesUrl(eventId: number): string {
    return `${BASE_URI}/events/${eventId}/whatsapp-templates`;
  }

  getTemplatesByEvent(eventId: number, search?: string): Observable<WhatsAppTemplate[]> {
    let params = new HttpParams();
    if (search && search.trim().length >= 2) {
      params = params.set('search', search.trim());
    }
    return this.http.get<WhatsAppTemplate[]>(this.templatesUrl(eventId), { params });
  }

  createTemplate(
    eventId: number,
    request: CreateWhatsAppTemplateRequest,
  ): Observable<WhatsAppTemplate> {
    return this.http.post<WhatsAppTemplate>(this.templatesUrl(eventId), request);
  }

  updateTemplate(
    eventId: number,
    templateId: number,
    request: UpdateWhatsAppTemplateRequest,
  ): Observable<WhatsAppTemplate> {
    return this.http.patch<WhatsAppTemplate>(
      `${this.templatesUrl(eventId)}/${templateId}`,
      request,
    );
  }

  deleteTemplate(eventId: number, templateId: number): Observable<void> {
    return this.http.delete<void>(`${this.templatesUrl(eventId)}/${templateId}`);
  }

  private campaignsUrl(eventId: number): string {
    return `${BASE_URI}/events/${eventId}/whatsapp-campaigns`;
  }

  getCampaignsByEvent(eventId: number): Observable<WhatsAppCampaign[]> {
    return this.http.get<WhatsAppCampaign[]>(this.campaignsUrl(eventId));
  }

  createCampaign(
    eventId: number,
    request: CreateWhatsAppCampaignRequest,
  ): Observable<WhatsAppCampaign> {
    return this.http.post<WhatsAppCampaign>(this.campaignsUrl(eventId), request);
  }

  updateCampaign(
    eventId: number,
    campaignId: number,
    request: UpdateWhatsAppCampaignRequest,
  ): Observable<WhatsAppCampaign> {
    return this.http.patch<WhatsAppCampaign>(
      `${this.campaignsUrl(eventId)}/${campaignId}`,
      request,
    );
  }

  deleteCampaign(eventId: number, campaignId: number): Observable<void> {
    return this.http.delete<void>(`${this.campaignsUrl(eventId)}/${campaignId}`);
  }

  disarmCampaign(eventId: number, campaignId: number): Observable<WhatsAppCampaign> {
    return this.http.patch<WhatsAppCampaign>(
      `${this.campaignsUrl(eventId)}/${campaignId}/disarm`,
      {},
    );
  }
}
