/**
 * Read a non-HttpOnly cookie by name. Returns null when missing.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const target = `${name}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.startsWith(target)) {
      return decodeURIComponent(part.substring(target.length));
    }
  }
  return null;
}
