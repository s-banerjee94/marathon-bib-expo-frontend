export const PLACEHOLDER_MAP: Record<string, string> = {
  fullName: "Participant's full name",
  bibNumber: 'Bib number',
  raceName: 'Race name',
  categoryName: 'Category name',
  bibCollectedAt: 'Bib collected timestamp',
  bibCollectedByName: 'Collected by (name)',
  bibCollectedByPhone: 'Collected by (phone)',
  eventName: 'Event name',
  venueName: 'Venue name',
  eventStartDate: 'Event start date',
  eventEndDate: 'Event end date',
  eventCity: 'Event city',
};

export const VALID_PLACEHOLDER_FIELDS = new Set(Object.keys(PLACEHOLDER_MAP));
