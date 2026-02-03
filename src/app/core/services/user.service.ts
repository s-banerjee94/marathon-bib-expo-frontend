import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserRequest, User } from '../models/user.model';
import { PageableResponse, PageableParams } from '../models/api.model';
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

    if (params.includeDeleted !== undefined) {
      httpParams = httpParams.set('includeDeleted', params.includeDeleted.toString());
    }

    if (params.role) {
      httpParams = httpParams.set('role', params.role);
    }

    if (params.organizationId !== undefined) {
      httpParams = httpParams.set('organizationId', params.organizationId.toString());
    }

    return this.http.get<PageableResponse<User>>(this.apiUrl, { params: httpParams });
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  toggleEnabled(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/toggle-enabled`, {});
  }
}
