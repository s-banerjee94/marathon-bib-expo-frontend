/**
 * Build avatar initials from a name, used as the fallback when no profile
 * picture is set:
 *  - two or more words -> first letter of the first two words ("John Doe" -> "JD")
 *  - a single word     -> its first two letters ("John" -> "JO")
 *  - empty / blank      -> "U"
 */
export function getInitials(name?: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
