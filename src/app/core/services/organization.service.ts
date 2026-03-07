import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateOrganizationRequest,
  Organization,
  UpdateOrganizationRequest,
} from '../models/organization.model';
import { PageableParams, PageableResponse } from '../models/api.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/organizations`;

  createOrganization(request: CreateOrganizationRequest): Observable<Organization> {
    return this.http.post<Organization>(this.apiUrl, request);
  }

  searchOrganizations(params: PageableParams): Observable<PageableResponse<Organization>> {
    let httpParams = new HttpParams();

    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }

    if (params.size !== undefined) {
      httpParams = httpParams.set('size', params.size.toString());
    }

    if (params.sort && params.sort.length > 0) {
      params.sort.forEach((sortParam) => {
        httpParams = httpParams.append('sort', sortParam);
      });
    }

    if (params.search) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    if (params.enabled !== undefined) {
      httpParams = httpParams.set('enabled', params.enabled.toString());
    }

    if (params.deleted !== undefined) {
      httpParams = httpParams.set('deleted', params.deleted.toString());
    }

    if (params.subscriptionTier) {
      httpParams = httpParams.set('subscriptionTier', params.subscriptionTier);
    }

    return this.http.get<PageableResponse<Organization>>(this.apiUrl, { params: httpParams });
  }

  getOrganizationById(id: number): Observable<Organization> {
    return this.http.get<Organization>(`${this.apiUrl}/${id}`);
  }

  updateOrganization(id: number, request: UpdateOrganizationRequest): Observable<Organization> {
    return this.http.patch<Organization>(`${this.apiUrl}/${id}`, request);
  }

  getCurrentUserOrganization(): Observable<Organization> {
    return this.http.get<Organization>(`${this.apiUrl}/organization`);
  }

  toggleStatus(id: number, enabled: boolean): Observable<Organization> {
    return this.http.patch<Organization>(`${this.apiUrl}/${id}/status`, enabled);
  }
}
