import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

/**
 * Signal of the active child-route segment, kept in sync with the router so a
 * tabbed page highlights the right tab on deep-link, refresh, and navigation.
 *
 * `read` extracts the segment from the component's own route snapshot — pass a
 * ready-made reader ({@link firstChildPath} / {@link deepestChildPath}) or an
 * inline one (e.g. a route param). `fallback` is used when nothing matches.
 *
 * MUST be called from an injection context (a component field initializer or
 * constructor): it injects the component's `ActivatedRoute` and the `Router`.
 */
export function activeChildRouteSignal(
  read: (root: ActivatedRouteSnapshot) => string | undefined,
  fallback: string,
): Signal<string> {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const current = (): string => read(route.snapshot) ?? fallback;
  return toSignal(
    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(current),
    ),
    { initialValue: current() },
  );
}

/** Reader: path of the immediate child route (the active tab of this shell). */
export function firstChildPath(root: ActivatedRouteSnapshot): string | undefined {
  return root.firstChild?.routeConfig?.path;
}

/** Reader: path of the deepest nested child route (for multi-level shells). */
export function deepestChildPath(root: ActivatedRouteSnapshot): string | undefined {
  let snapshot: ActivatedRouteSnapshot | null = root.firstChild;
  while (snapshot?.firstChild) {
    snapshot = snapshot.firstChild;
  }
  return snapshot?.routeConfig?.path;
}
