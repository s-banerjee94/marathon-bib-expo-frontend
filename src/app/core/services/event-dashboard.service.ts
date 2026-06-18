import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import { EventDashboardRange, EventDashboardResponse } from '../models/event-dashboard.model';

@Injectable({ providedIn: 'root' })
export class EventDashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/events`;

  /** Single round-trip rollup powering the event-details Dashboard tab. */
  getEventDashboard(
    eventId: number,
    range: EventDashboardRange = 'TODAY',
  ): Observable<EventDashboardResponse> {
    const params = new HttpParams().set('range', range);
    return this.http.get<EventDashboardResponse>(`${this.apiUrl}/${eventId}/dashboard`, { params });
  }
}
