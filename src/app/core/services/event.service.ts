import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Category,
  CreateEventRequest,
  Event,
  Race,
  UpdateEventRequest,
} from '../models/event.model';
import { EventLimit, UpdateEventLimitRequest } from '../models/event-limit.model';
import { PageableParams, PageableResponse } from '../models/api.model';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user.model';
import { BASE_URI } from '../../shared/constants/api.constant';
import { buildHttpParams } from '../../shared/utils/http-params.utils';

@Injectable({
  providedIn: 'root',
})
export class EventService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${BASE_URI}/events`;

  searchEvents(params: PageableParams): Observable<PageableResponse<Event>> {
    const isRootOrAdmin = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);
    const httpParams = buildHttpParams(
      isRootOrAdmin ? params : { ...params, organizationId: undefined },
    );

    if (isRootOrAdmin) {
      return this.http.get<PageableResponse<Event>>(this.baseUrl, { params: httpParams });
    } else {
      return this.http.get<PageableResponse<Event>>(`${this.baseUrl}/organization`, {
        params: httpParams,
      });
    }
  }

  getEventById(id: number): Observable<Event> {
    return this.http.get<Event>(`${this.baseUrl}/${id}`);
  }

  createEvent(request: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.baseUrl, request);
  }

  updateEvent(id: number, request: UpdateEventRequest): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}`, request);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getRaces(eventId: number): Observable<Race[]> {
    return this.http.get<Race[]>(`${this.baseUrl}/${eventId}/races`);
  }

  getCategoriesByRace(eventId: number, raceId: number): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/${eventId}/races/${raceId}/categories`);
  }

  toggleEnabled(id: number): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}/toggle-enabled`, {});
  }

  changeEventStatus(id: number, status: string): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}/status`, null, {
      params: { status },
    });
  }

  /** Per-event resource limits. Backend restricts both calls to ROOT/ADMIN. */
  getEventLimits(eventId: number): Observable<EventLimit> {
    return this.http.get<EventLimit>(`${this.baseUrl}/${eventId}/limits`);
  }

  updateEventLimits(eventId: number, request: UpdateEventLimitRequest): Observable<EventLimit> {
    return this.http.patch<EventLimit>(`${this.baseUrl}/${eventId}/limits`, request);
  }
}
