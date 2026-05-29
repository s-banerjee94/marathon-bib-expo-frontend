import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import { OrgDashboardParams, OrgDashboardResponse } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/dashboard/organization`;

  getOrgDashboard(params: OrgDashboardParams = {}): Observable<OrgDashboardResponse> {
    return this.http.get<OrgDashboardResponse>(this.apiUrl, { params: this.toHttpParams(params) });
  }

  refreshOrgDashboard(params: OrgDashboardParams = {}): Observable<OrgDashboardResponse> {
    return this.http.post<OrgDashboardResponse>(
      `${this.apiUrl}/refresh`,
      {},
      { params: this.toHttpParams(params) },
    );
  }

  private toHttpParams(params: OrgDashboardParams): HttpParams {
    let httpParams = new HttpParams();
    if (params.range) httpParams = httpParams.set('range', params.range);
    if (params.statusRange) httpParams = httpParams.set('statusRange', params.statusRange);
    if (params.citiesRange) httpParams = httpParams.set('citiesRange', params.citiesRange);
    if (params.trendBuckets !== undefined)
      httpParams = httpParams.set('trendBuckets', params.trendBuckets.toString());
    if (params.trendInterval) httpParams = httpParams.set('trendInterval', params.trendInterval);
    if (params.topCities !== undefined)
      httpParams = httpParams.set('topCities', params.topCities.toString());
    return httpParams;
  }
}
