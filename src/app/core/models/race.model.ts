/**
 * Race model matching backend RaceResponse
 * Per Swagger spec: RaceResponse does not include deleted/enabled fields
 */
export interface Race {
  id: number;
  raceName: string;
  raceDescription?: string;
  eventId: number;
  categoryCount: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface CreateRaceRequest {
  raceName: string;
  raceDescription?: string;
}

export interface UpdateRaceRequest {
  raceName?: string;
  raceDescription?: string;
}
