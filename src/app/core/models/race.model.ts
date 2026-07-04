/**
 * Race model matching backend RaceResponse
 * Per Swagger spec: RaceResponse does not include deleted/enabled fields
 */
export interface Race {
  id: number;
  raceName: string;
  raceDescription?: string;
  /** Race-day reporting date (yyyy-MM-dd) as local wall-clock in the parent
   * event's timezone; null when unset. Always paired with reportingTime. */
  reportingDate?: string;
  /** Race-day reporting time (HH:mm, 24h) as local wall-clock in the parent
   * event's timezone; null when unset. Always paired with reportingDate. */
  reportingTime?: string;
  eventId: number;
  organizationId?: number;
  categoryCount: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

// reportingDate + reportingTime are local wall-clock (the server interprets them
// in the event's timezone — no client TZ math). Send both or neither.
export interface CreateRaceRequest {
  raceName: string;
  raceDescription?: string;
  reportingDate?: string;
  reportingTime?: string;
}

export interface UpdateRaceRequest {
  raceName?: string;
  raceDescription?: string;
  reportingDate?: string;
  reportingTime?: string;
}
