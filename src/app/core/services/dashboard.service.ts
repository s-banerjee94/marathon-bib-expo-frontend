import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import {
  OrgDashboardParams,
  OrgDashboardResponse,
  PlatformDashboardParams,
  PlatformDashboardResponse,
  PlatformRevenueParams,
  PlatformRevenueResponse,
} from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private orgApiUrl = `${BASE_URI}/dashboard/organization`;
  private platformApiUrl = `${BASE_URI}/dashboard/platform`;

  getOrgDashboard(params: OrgDashboardParams = {}): Observable<OrgDashboardResponse> {
    return this.http.get<OrgDashboardResponse>(this.orgApiUrl, {
      params: this.toOrgParams(params),
    });
  }

  refreshOrgDashboard(params: OrgDashboardParams = {}): Observable<OrgDashboardResponse> {
    return this.http.post<OrgDashboardResponse>(
      `${this.orgApiUrl}/refresh`,
      {},
      { params: this.toOrgParams(params) },
    );
  }

  getPlatformDashboard(
    params: PlatformDashboardParams = {},
  ): Observable<PlatformDashboardResponse> {
    return this.http.get<PlatformDashboardResponse>(this.platformApiUrl, {
      params: this.toPlatformParams(params),
    });
  }

  refreshPlatformDashboard(
    params: PlatformDashboardParams = {},
  ): Observable<PlatformDashboardResponse> {
    return this.http.post<PlatformDashboardResponse>(
      `${this.platformApiUrl}/refresh`,
      {},
      { params: this.toPlatformParams(params) },
    );
  }

  getPlatformRevenue(params: PlatformRevenueParams = {}): Observable<PlatformRevenueResponse> {
    return this.http.get<PlatformRevenueResponse>(`${this.platformApiUrl}/revenue`, {
      params: this.toRevenueParams(params),
    });
  }

  private toOrgParams(params: OrgDashboardParams): HttpParams {
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

  private toPlatformParams(params: PlatformDashboardParams): HttpParams {
    let httpParams = new HttpParams();
    if (params.range) httpParams = httpParams.set('range', params.range);
    if (params.tierRange) httpParams = httpParams.set('tierRange', params.tierRange);
    if (params.statusRange) httpParams = httpParams.set('statusRange', params.statusRange);
    if (params.citiesRange) httpParams = httpParams.set('citiesRange', params.citiesRange);
    if (params.trendBuckets !== undefined)
      httpParams = httpParams.set('trendBuckets', params.trendBuckets.toString());
    if (params.trendInterval) httpParams = httpParams.set('trendInterval', params.trendInterval);
    if (params.topCities !== undefined)
      httpParams = httpParams.set('topCities', params.topCities.toString());
    if (params.topOrgs !== undefined)
      httpParams = httpParams.set('topOrgs', params.topOrgs.toString());
    return httpParams;
  }

  private toRevenueParams(params: PlatformRevenueParams): HttpParams {
    let httpParams = new HttpParams();
    if (params.range) httpParams = httpParams.set('range', params.range);
    if (params.trendBuckets !== undefined)
      httpParams = httpParams.set('trendBuckets', params.trendBuckets.toString());
    if (params.trendInterval) httpParams = httpParams.set('trendInterval', params.trendInterval);
    return httpParams;
  }
}
