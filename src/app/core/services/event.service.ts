import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Event, CreateEventRequest, UpdateEventRequest } from '../models/event.model';
import { PageableParams, PageableResponse } from '../models/api.model';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user.model';

/**
 * Event Service
 * Handles all event-related API operations (CRUD + search)
 * Intelligently routes to appropriate endpoint based on user role
 */
@Injectable({
  providedIn: 'root',
})
export class EventService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = '/api/events';

  /**
   * Search events with pagination, filtering, and sorting
   * Intelligently routes to appropriate endpoint based on user role:
   * - ROOT/ADMIN: Uses /api/events (can see all events from all organizations)
   * - ORGANIZER users: Uses /api/events/organization (scoped to their organization)
   * @param params Pageable parameters including search, filters, sort, and pagination
   * @returns Observable of pageable event response
   */
  searchEvents(params: PageableParams): Observable<PageableResponse<Event>> {
    // Build HTTP params from PageableParams object
    let httpParams = new HttpParams();

    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.size !== undefined) {
      httpParams = httpParams.set('size', params.size.toString());
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.sort && params.sort.length > 0) {
      // Append each sort parameter separately for Spring Boot compatibility
      params.sort.forEach((sortParam) => {
        httpParams = httpParams.append('sort', sortParam);
      });
    }
    // Event status filter (DRAFT, PUBLISHED, CANCELLED, COMPLETED)
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }

    // Determine endpoint based on user role
    const isRootOrAdmin = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

    if (isRootOrAdmin) {
      // ROOT/ADMIN: Use /api/events endpoint with additional filters
      // Supports organizationId filter and can see all organizations
      if (params.organizationId !== undefined) {
        httpParams = httpParams.set('organizationId', params.organizationId.toString());
      }
      return this.http.get<PageableResponse<Event>>(this.baseUrl, {
        params: httpParams,
      });
    } else {
      // ORGANIZER users: Use /api/events/organization (automatically scoped to their org)
      return this.http.get<PageableResponse<Event>>(`${this.baseUrl}/organization`, {
        params: httpParams,
      });
    }
  }

  /**
   * Get event by ID
   * @param id Event ID
   * @returns Observable of event
   */
  getEventById(id: number): Observable<Event> {
    return this.http.get<Event>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create new event
   * @param request Event creation data
   * @returns Observable of created event
   */
  createEvent(request: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.baseUrl, request);
  }

  /**
   * Update existing event
   * @param id Event ID to update
   * @param request Event update data (partial)
   * @returns Observable of updated event
   */
  updateEvent(id: number, request: UpdateEventRequest): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Delete event (soft delete)
   * @param id Event ID to delete
   * @returns Observable of void
   */
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Toggle event enabled status
   * Only accessible by ROOT and ADMIN users
   * @param id Event ID
   * @returns Observable of updated event
   */
  toggleEnabled(id: number): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}/toggle-enabled`, {});
  }

  /**
   * Change event status
   * Accessible by ROOT, ADMIN, ORGANIZER_ADMIN, and ORGANIZER_USER
   * @param id Event ID
   * @param status New event status (DRAFT, PUBLISHED, CANCELLED, COMPLETED)
   * @returns Observable of updated event
   */
  changeEventStatus(id: number, status: string): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}/status`, null, {
      params: { status },
    });
  }
}
