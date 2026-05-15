import ct from 'countries-and-timezones';

export interface CountryOption {
  label: string;
  value: string;
  iso2: string;
  timezones: string[];
}

export const COUNTRY_OPTIONS: CountryOption[] = Object.values(ct.getAllCountries())
  .map((c) => ({
    label: c.name,
    value: c.name,
    iso2: c.id.toLowerCase(),
    timezones: c.timezones,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const COUNTRY_BY_NAME = new Map<string, CountryOption>(COUNTRY_OPTIONS.map((c) => [c.value, c]));

export function getCountryIso2(countryName: string): string {
  return COUNTRY_BY_NAME.get(countryName)?.iso2 ?? '';
}

export function toFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('');
}

export function detectBrowserLocale(): { country: string; timezone: string } {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzInfo = ct.getTimezone(timezone);
    if (tzInfo && tzInfo.countries.length === 1) {
      const country = ct.getCountry(tzInfo.countries[0]);
      if (country) return { country: country.name, timezone };
    }
    return { country: '', timezone };
  } catch {
    return { country: '', timezone: '' };
  }
}

export function getCountryTimezones(countryName: string): string[] {
  return COUNTRY_BY_NAME.get(countryName)?.timezones ?? [];
}
