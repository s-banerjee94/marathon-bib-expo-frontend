// Shared formatting helpers for the public verification page and expo card.

// First + last initial(s) from a full name, e.g. "Ranajoy Paul" -> "RP".
export function getInitials(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Human-readable gender label, e.g. "M" -> "Male". Empty when unset.
export function formatGender(gender: string | null | undefined): string {
  const g = (gender ?? '').trim().toUpperCase();
  if (!g) return '';
  if (g === 'M' || g === 'MALE') return 'Male';
  if (g === 'F' || g === 'FEMALE') return 'Female';
  if (g === 'O' || g === 'OTHER') return 'Other';
  return g.charAt(0) + g.slice(1).toLowerCase();
}
