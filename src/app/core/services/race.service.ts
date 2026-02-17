import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Race, CreateRaceRequest, UpdateRaceRequest } from '../models/race.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class RaceService {
  private http = inject(HttpClient);

  getRacesByEventId(eventId: number): Observable<Race[]> {
    return this.http.get<Race[]>(`${BASE_URI}/events/${eventId}/races`);
  }

  getRaceById(eventId: number, raceId: number): Observable<Race> {
    return this.http.get<Race>(`${BASE_URI}/events/${eventId}/races/${raceId}`);
  }

  createRace(eventId: number, request: CreateRaceRequest): Observable<Race> {
    return this.http.post<Race>(`${BASE_URI}/events/${eventId}/races`, request);
  }

  updateRace(eventId: number, raceId: number, request: UpdateRaceRequest): Observable<Race> {
    return this.http.patch<Race>(`${BASE_URI}/events/${eventId}/races/${raceId}`, request);
  }

  deleteRace(eventId: number, raceId: number): Observable<void> {
    return this.http.delete<void>(`${BASE_URI}/events/${eventId}/races/${raceId}`);
  }
}
