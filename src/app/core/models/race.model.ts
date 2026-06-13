/**
 * Race model matching backend RaceResponse
 * Per Swagger spec: RaceResponse does not include deleted/enabled fields
 */
export interface Race {
  id: number;
  raceName: string;
  raceDescription?: string;
  /** Reporting time as a UTC instant (ISO-8601); interpreted in the parent event's timezone. */
  reportingTime?: string;
  eventId: number;
  organizationId?: number;
  categoryCount: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface CreateRaceRequest {
  raceName: string;
  raceDescription?: string;
  reportingTime?: string;
}

export interface UpdateRaceRequest {
  raceName?: string;
  raceDescription?: string;
  reportingTime?: string;
}
