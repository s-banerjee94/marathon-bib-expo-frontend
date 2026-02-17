import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SmsTemplate,
  CreateSmsTemplateRequest,
  UpdateSmsTemplateRequest,
} from '../models/sms-template.model';
import { PageableParams, PageableResponse } from '../models/api.model';
import { BASE_URI } from '../../shared/constants/api.constant';
import { buildHttpParams } from '../../shared/utils/http-params.utils';

@Injectable({
  providedIn: 'root',
})
export class SmsTemplateService {
  private http = inject(HttpClient);

  getSmsTemplatesByEvent(
    eventId: number,
    params: PageableParams & { enabledOnly?: boolean },
  ): Observable<PageableResponse<SmsTemplate>> {
    let httpParams = buildHttpParams(params);

    if (params.enabledOnly !== undefined) {
      httpParams = httpParams.set('enabledOnly', params.enabledOnly.toString());
    }

    return this.http.get<PageableResponse<SmsTemplate>>(
      `${BASE_URI}/events/${eventId}/sms-templates`,
      { params: httpParams },
    );
  }

  getSmsTemplateById(eventId: number, templateId: number): Observable<SmsTemplate> {
    return this.http.get<SmsTemplate>(`${BASE_URI}/events/${eventId}/sms-templates/${templateId}`);
  }

  getSmsTemplateBySmsTemplateId(eventId: number, smsTemplateId: string): Observable<SmsTemplate> {
    return this.http.get<SmsTemplate>(
      `${BASE_URI}/events/${eventId}/sms-templates/by-template-id/${smsTemplateId}`,
    );
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

  toggleSmsTemplateEnabled(eventId: number, templateId: number): Observable<SmsTemplate> {
    return this.http.patch<SmsTemplate>(
      `${BASE_URI}/events/${eventId}/sms-templates/${templateId}/toggle-enabled`,
      {},
    );
  }
}
