import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserRequest, UpdateUserRequest, User } from '../models/user.model';
import { PageableParams, PageableResponse } from '../models/api.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/users`;

  createUser(request: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.apiUrl, request);
  }

  searchUsers(params: PageableParams): Observable<PageableResponse<User>> {
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

    if (params.role) {
      httpParams = httpParams.set('role', params.role);
    }

    if (params.organizationId !== undefined) {
      httpParams = httpParams.set('organizationId', params.organizationId.toString());
    }

    if (params.eventId !== undefined) {
      httpParams = httpParams.set('eventId', params.eventId.toString());
    }

    return this.http.get<PageableResponse<User>>(this.apiUrl, { params: httpParams });
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  updateUser(id: number, request: UpdateUserRequest): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, request);
  }

  toggleEnabled(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/toggle-enabled`, {});
  }

  /**
   * Reassign a distributor to a different event in the same organization. The
   * target must be a distributor and the new event must be in-org and not
   * completed/cancelled (enforced by the backend). Returns the updated user.
   */
  reassignDistributorEvent(userId: number, eventId: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${userId}/event`, { eventId });
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
