import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateOrganizationRequest,
  Organization,
  UpdateOrganizationRequest,
} from '../models/organization.model';
import { PageableParams, PageableResponse } from '../models/api.model';
import { BASE_URI } from '../../shared/constants/api.constant';
import { buildHttpParams } from '../../shared/utils/http-params.utils';

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
    return this.http.get<PageableResponse<Organization>>(this.apiUrl, {
      params: buildHttpParams(params),
    });
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

  // Permanent hard delete: removes the organization and all its users. The backend
  // rejects this with 400 when the organization still has events (and therefore bills).
  deleteOrganization(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
