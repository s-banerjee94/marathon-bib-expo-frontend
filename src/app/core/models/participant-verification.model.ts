// Response from the public short-link endpoint: GET /s/{shortCode} (no auth).
// Matches the backend ParticipantVerificationResponse DTO.
export interface ParticipantVerificationResponse {
  // Event
  eventName: string;
  eventStartDate?: string; // ISO-8601 (UTC), e.g. 2026-11-08T00:30:00Z
  eventEndDate?: string; // ISO-8601 (UTC)
  eventVanue?: string; // backend spelling of "venue"
  eventTimezone?: string | null; // IANA zone id, e.g. "Asia/Kolkata"; event times render in this zone

  // Participant
  fullName: string;
  gender?: string; // M | F | O
  age?: number;
  city?: string | null;
  country?: string | null;
  email?: string;
  phoneNumber?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;

  // Bib & race assignment
  bibNumber: string;
  chipNumber?: string;
  raceName?: string;
  categoryName?: string;

  // Bib collection
  bibCollectedAt?: string | null; // ISO-8601 (UTC); null when not yet collected
  bibCollectedByName?: string | null;
  bibCollectedByPhone?: string | null;

  // Goodies distribution — key is the goodie name, value is a JSON string
  // of { collectedAt, distributedBy } where distributedBy is "id__|__username".
  goodiesDistribution?: Record<string, string> | null;

  // QR — a ready-to-use data URI (data:image/png;base64,...).
  qrCodeDataUri?: string;
}
