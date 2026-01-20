import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import {
  CreateOrganizationRequest,
  Organization,
  UpdateOrganizationRequest,
} from '../models/organization.model';
import { PageableResponse, PageableParams } from '../models/api.model';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private http = inject(HttpClient);
  private apiUrl = '/api/organizations';

  createOrganization(request: CreateOrganizationRequest): Observable<Organization> {
    return this.http.post<Organization>(this.apiUrl, request);
  }

  getAllOrganizations(): Observable<Organization[]> {
    return this.http.get<Organization[]>(this.apiUrl);
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

    return this.http.get<PageableResponse<Organization>>(this.apiUrl, { params: httpParams });
  }

  getOrganizationById(id: number): Observable<Organization> {
    return this.http.get<Organization>(`${this.apiUrl}/${id}`);
  }

  // Mock method for edit mode (no backend integration)
  getMockOrganizationById(id: number): Observable<Organization> {
    const mockOrg: Organization = {
      id: id,
      organizerName: `Marathon Organizer ${id}`,
      email: `org${id}@example.com`,
      phoneNumber: `+1-555-${String(id).padStart(4, '0')}`,
      website: `https://marathon${id}.example.com`,
      addressLine1: `${id * 100} Race Street`,
      addressLine2: id % 2 === 0 ? `Suite ${id}` : undefined,
      city: 'Marathon City',
      stateProvince: 'MC',
      postalCode: `${String(id).padStart(5, '0')}`,
      country: 'USA',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Simulate network delay
    return of(mockOrg).pipe(delay(500));
  }

  updateOrganization(id: number, request: UpdateOrganizationRequest): Observable<Organization> {
    return this.http.patch<Organization>(`${this.apiUrl}/${id}`, request);
  }
}
