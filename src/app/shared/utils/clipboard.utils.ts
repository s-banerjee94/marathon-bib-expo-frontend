/** Whether the Web Share API is available (mostly mobile browsers). */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Copy text to the clipboard, returning whether it succeeded.
 * navigator.clipboard only exists in secure contexts (https/localhost), so on a
 * phone hitting the dev server over plain-http LAN it's undefined — fall back to
 * the legacy execCommand path via a temporary textarea.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission/context failure — try the legacy path below.
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'dismissed' | 'failed';

/**
 * Open the native share sheet. 'dismissed' means the user closed the sheet
 * themselves (callers should not fall back to a copy); 'failed' means sharing
 * is unsupported or errored, so a clipboard fallback is appropriate.
 */
export async function shareUrl(data: ShareData): Promise<ShareOutcome> {
  if (!canNativeShare()) return 'failed';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'dismissed';
    return 'failed';
  }
}
