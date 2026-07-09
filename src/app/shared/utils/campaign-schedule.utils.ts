// Date/time helpers shared by the SMS and WhatsApp campaign forms. Campaigns
// store scheduledDate ('yyyy-MM-dd') and scheduledTime ('HH:mm') separately; the
// forms edit them as a single Date in local (event) wall-clock time.

export function parseScheduledDateTime(date?: string, time?: string): Date | null {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

export function toScheduledDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toScheduledTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Earliest selectable schedule: ~3 minutes out, expressed in the event timezone's
// wall-clock so the picker's min matches what the user sees.
export function computeMinScheduledDate(timezone: string): Date {
  const nowPlus3 = new Date(Date.now() + 3 * 60 * 1000);
  if (!timezone) return nowPlus3;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(nowPlus3);
    const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    return new Date(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  } catch {
    return nowPlus3;
  }
}
