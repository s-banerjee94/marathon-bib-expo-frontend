/**
 * Event Status Enum
 * Represents the lifecycle states of an event
 */
export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/**
 * Event model matching backend EventResponse
 * Represents a marathon or race event with all its details
 */
export interface Event {
  id: number;
  eventName: string;
  eventDescription?: string;
  logoUrl?: string; // Backend field, not used in form
  eventStartDate: Date;
  eventEndDate: Date;
  venueName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  latitude?: number; // Backend field, not used in form
  longitude?: number; // Backend field, not used in form
  status: EventStatus;
  organizationId: number;
  eventGoodies?: string; // Backend field, not used in form
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
}

/**
 * Create Event Request DTO
 */
export interface CreateEventRequest {
  eventName: string;
  eventDescription?: string;
  logoUrl?: string;
  eventStartDate: Date;
  eventEndDate: Date;
  venueName: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  status?: EventStatus;
  organizationId: number;
  eventGoodies?: string;
}

/**
 * Update Event Request DTO (all fields optional for PATCH)
 */
export interface UpdateEventRequest {
  eventName?: string;
  eventDescription?: string;
  logoUrl?: string;
  eventStartDate?: Date;
  eventEndDate?: Date;
  venueName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  status?: EventStatus;
  eventGoodies?: string;
}

/**
 * Race Summary (for Event Summary Response)
 */
export interface RaceSummary {
  id: number;
  raceName: string;
  categoryCount: number;
}

/**
 * Event Summary Response with races and categories
 */
export interface EventSummaryResponse {
  event: Event;
  races: RaceSummary[];
  totalRaces: number;
  totalCategories: number;
}
