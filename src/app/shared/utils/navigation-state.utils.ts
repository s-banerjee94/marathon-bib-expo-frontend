/**
 * Quick-create deep-linking via Router navigation state
 * (`router.navigate([...], { state: { create: true } })`).
 *
 * A `?create=true` query param needs a second "strip" navigation from inside the
 * target component; fired mid-activation it supersedes the original navigation,
 * so NavigationEnd never emits and routerLinkActive / the page title stay frozen
 * on the previous route. Navigation state avoids the second navigation entirely.
 */
export interface CreateNavigationState {
  create?: boolean;
  createRole?: string;
}

/**
 * Read-and-clear the quick-create flag for the current history entry. Clearing
 * uses history.replaceState directly (not a router navigation), so a browser
 * refresh doesn't reopen the dialog.
 */
export function consumeCreateNavigationState(): { createRole: string | null } | null {
  const state = (history.state ?? {}) as CreateNavigationState & Record<string, unknown>;
  if (!state.create) return null;
  const cleaned = { ...state };
  delete cleaned.create;
  delete cleaned.createRole;
  history.replaceState(cleaned, '');
  return { createRole: state.createRole ?? null };
}
