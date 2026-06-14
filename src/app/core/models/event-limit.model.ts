/**
 * Per-event resource limits (backend group `3-event-management`).
 * GET/PATCH `/api/events/{eventId}/limits` — ROOT/ADMIN only on the backend.
 * Each cap is an int >= 1; PATCH is partial (omitted fields are left unchanged).
 */
export interface EventLimit {
  eventId: number;
  maxParticipants: number;
  maxRaces: number;
  maxCategoriesPerRace: number;
  maxGoodies: number;
  maxSmsTemplates: number;
  maxSmsCampaigns: number;
  maxImports: number;
  maxAddOns: number;
}

/** Partial update — only provided fields are changed; every value must be >= 1. */
export interface UpdateEventLimitRequest {
  maxParticipants?: number;
  maxRaces?: number;
  maxCategoriesPerRace?: number;
  maxGoodies?: number;
  maxSmsTemplates?: number;
  maxSmsCampaigns?: number;
  maxImports?: number;
  maxAddOns?: number;
}
