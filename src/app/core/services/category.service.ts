import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../models/category.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private http = inject(HttpClient);

  getCategoriesByRaceId(eventId: number, raceId: number, gender?: string): Observable<Category[]> {
    let url = `${BASE_URI}/events/${eventId}/races/${raceId}/categories`;
    if (gender) {
      url += `?gender=${gender}`;
    }
    return this.http.get<Category[]>(url);
  }

  getCategoryById(eventId: number, raceId: number, categoryId: number): Observable<Category> {
    return this.http.get<Category>(
      `${BASE_URI}/events/${eventId}/races/${raceId}/categories/${categoryId}`,
    );
  }

  createCategory(
    eventId: number,
    raceId: number,
    request: CreateCategoryRequest,
  ): Observable<Category> {
    return this.http.post<Category>(
      `${BASE_URI}/events/${eventId}/races/${raceId}/categories`,
      request,
    );
  }

  updateCategory(
    eventId: number,
    raceId: number,
    categoryId: number,
    request: UpdateCategoryRequest,
  ): Observable<Category> {
    return this.http.patch<Category>(
      `${BASE_URI}/events/${eventId}/races/${raceId}/categories/${categoryId}`,
      request,
    );
  }

  deleteCategory(eventId: number, raceId: number, categoryId: number): Observable<void> {
    return this.http.delete<void>(
      `${BASE_URI}/events/${eventId}/races/${raceId}/categories/${categoryId}`,
    );
  }
}
