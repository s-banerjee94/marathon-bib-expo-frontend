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

  /**
   * Resolve a user by their username. Used to turn the `createdBy`/`lastModifiedBy`
   * audit usernames into a display name + avatar. The backend returns 404/403 when
   * the caller (an org-scoped role) asks for a user outside their organization or a
   * ROOT/ADMIN user — callers should treat that as "unresolvable", not an error.
   */
  getUserByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/by-username/${encodeURIComponent(username)}`);
  }

  updateUser(id: number, request: UpdateUserRequest): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, request);
  }

  toggleEnabled(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/toggle-enabled`, {});
  }

  /**
   * Lock or unlock a user (ROOT/ADMIN only; org roles get 403). No body — each
   * call flips the current state. The returned user's `accountNonLocked` is the
   * new state: `true` = unlocked, `false` = locked (locked users cannot log in).
   */
  toggleLocked(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/toggle-locked`, {});
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
