// Helpers for converting between a UTC instant (ISO-8601, what the backend
// stores) and the wall-clock time in a specific IANA timezone (what the user
// sees and edits). PrimeNG's DatePicker works in browser-local wall-clock
// fields, so these re-base those fields into / out of the event timezone.

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return {
    y: g('year'),
    mo: g('month'),
    d: g('day'),
    h: g('hour'),
    mi: g('minute'),
    s: g('second'),
  };
}

// Offset (ms) of `timeZone` at the given instant: zoned wall-clock − UTC.
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUtc - date.getTime();
}

/**
 * UTC instant (ISO string) → Date whose browser-local fields equal the
 * event-timezone wall-clock. Use to populate a DatePicker for editing.
 */
export function utcInstantToZonedDate(
  iso: string | null | undefined,
  timeZone: string,
): Date | null {
  if (!iso) return null;
  const instant = new Date(iso);
  if (isNaN(instant.getTime())) return null;
  if (!timeZone) return instant;
  const p = zonedParts(instant, timeZone);
  return new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
}

/**
 * DatePicker Date (browser-local fields = intended event-timezone wall-clock)
 * → UTC instant ISO string for the backend.
 */
export function zonedDateToUtcInstant(
  wallClock: Date | null | undefined,
  timeZone: string,
): string | null {
  if (!wallClock) return null;
  if (!timeZone) return wallClock.toISOString();
  const asIfUtc = Date.UTC(
    wallClock.getFullYear(),
    wallClock.getMonth(),
    wallClock.getDate(),
    wallClock.getHours(),
    wallClock.getMinutes(),
    0,
  );
  // One pass is correct except inside the ~1h DST overlap, which reporting
  // times never fall in meaningfully.
  const offset = zoneOffsetMs(new Date(asIfUtc), timeZone);
  return new Date(asIfUtc - offset).toISOString();
}

/**
 * UTC instant → display string in the event timezone, with the (DST-aware)
 * timezone abbreviation appended, e.g. '15 Jun 2026, 05:30 AM (GST)'.
 */
export function formatUtcInstantInZone(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const instant = new Date(iso);
  if (isNaN(instant.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  if (timeZone) opts.timeZone = timeZone;
  const formatted = new Intl.DateTimeFormat('en-GB', opts)
    .format(instant)
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
  const abbr = timeZone ? zoneAbbreviation(instant, timeZone) : '';
  return abbr ? `${formatted} (${abbr})` : formatted;
}

// DST-aware short timezone name (e.g. 'GST', 'GMT+5:30') at the given instant.
function zoneAbbreviation(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}
