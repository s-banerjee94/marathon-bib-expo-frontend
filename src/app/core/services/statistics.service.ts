import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import {
  UserStatisticsResponse,
  OrganizationStatisticsResponse,
  EventStatisticsResponse,
} from '../models/statistics.model';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private http = inject(HttpClient);

  getUserStatistics(): Observable<UserStatisticsResponse> {
    return this.http.get<UserStatisticsResponse>(`${BASE_URI}/statistics/users`);
  }

  getOrganizationStatistics(): Observable<OrganizationStatisticsResponse> {
    return this.http.get<OrganizationStatisticsResponse>(`${BASE_URI}/statistics/organizations`);
  }

  getEventStatistics(): Observable<EventStatisticsResponse> {
    return this.http.get<EventStatisticsResponse>(`${BASE_URI}/statistics/events`);
  }

  refreshUserStatistics(): Observable<UserStatisticsResponse> {
    return this.http.post<UserStatisticsResponse>(`${BASE_URI}/statistics/users/refresh`, {});
  }

  refreshOrganizationStatistics(): Observable<OrganizationStatisticsResponse> {
    return this.http.post<OrganizationStatisticsResponse>(
      `${BASE_URI}/statistics/organizations/refresh`,
      {},
    );
  }

  refreshEventStatistics(): Observable<EventStatisticsResponse> {
    return this.http.post<EventStatisticsResponse>(`${BASE_URI}/statistics/events/refresh`, {});
  }
}
