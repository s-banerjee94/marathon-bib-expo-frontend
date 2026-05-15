import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SmsTemplate,
  CreateSmsTemplateRequest,
  UpdateSmsTemplateRequest,
} from '../models/sms-template.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class SmsTemplateService {
  private http = inject(HttpClient);

  getSmsTemplatesByEvent(eventId: number, search?: string): Observable<SmsTemplate[]> {
    let params = new HttpParams();
    if (search && search.trim().length >= 2) {
      params = params.set('search', search.trim());
    }
    return this.http.get<SmsTemplate[]>(`${BASE_URI}/events/${eventId}/sms-templates`, { params });
  }

  createSmsTemplate(eventId: number, request: CreateSmsTemplateRequest): Observable<SmsTemplate> {
    return this.http.post<SmsTemplate>(`${BASE_URI}/events/${eventId}/sms-templates`, request);
  }

  updateSmsTemplate(
    eventId: number,
    templateId: number,
    request: UpdateSmsTemplateRequest,
  ): Observable<SmsTemplate> {
    return this.http.patch<SmsTemplate>(
      `${BASE_URI}/events/${eventId}/sms-templates/${templateId}`,
      request,
    );
  }

  deleteSmsTemplate(eventId: number, templateId: number): Observable<void> {
    return this.http.delete<void>(`${BASE_URI}/events/${eventId}/sms-templates/${templateId}`);
  }
}
