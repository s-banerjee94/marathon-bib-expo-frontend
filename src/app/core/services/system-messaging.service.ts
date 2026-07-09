import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import {
  MessagePurpose,
  MessagingChannel,
  MessagingProviderResponse,
  SaveMessagingProviderRequest,
  SaveSystemMessageTemplateRequest,
  SystemMessageTemplateResponse,
} from '../models/system-messaging.model';

// ROOT-only configuration of messaging provider connections and system message
// templates. All endpoints live under /system. get-by-key endpoints 404 when the
// channel/template is not yet configured — callers treat that as an empty form.
@Injectable({
  providedIn: 'root',
})
export class SystemMessagingService {
  private http = inject(HttpClient);

  private providersUrl = `${BASE_URI}/system/messaging-providers`;
  private templatesUrl = `${BASE_URI}/system/message-templates`;

  listProviders(): Observable<MessagingProviderResponse[]> {
    return this.http.get<MessagingProviderResponse[]>(this.providersUrl);
  }

  getProvider(channel: MessagingChannel): Observable<MessagingProviderResponse> {
    return this.http.get<MessagingProviderResponse>(`${this.providersUrl}/${channel}`);
  }

  saveProvider(
    channel: MessagingChannel,
    request: SaveMessagingProviderRequest,
  ): Observable<MessagingProviderResponse> {
    return this.http.put<MessagingProviderResponse>(`${this.providersUrl}/${channel}`, request);
  }

  listTemplates(): Observable<SystemMessageTemplateResponse[]> {
    return this.http.get<SystemMessageTemplateResponse[]>(this.templatesUrl);
  }

  getTemplate(
    purpose: MessagePurpose,
    channel: MessagingChannel,
  ): Observable<SystemMessageTemplateResponse> {
    return this.http.get<SystemMessageTemplateResponse>(
      `${this.templatesUrl}/${purpose}/${channel}`,
    );
  }

  saveTemplate(
    purpose: MessagePurpose,
    channel: MessagingChannel,
    request: SaveSystemMessageTemplateRequest,
  ): Observable<SystemMessageTemplateResponse> {
    return this.http.put<SystemMessageTemplateResponse>(
      `${this.templatesUrl}/${purpose}/${channel}`,
      request,
    );
  }
}
