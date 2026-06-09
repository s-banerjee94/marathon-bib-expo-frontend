import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { OrganizationService } from './organization.service';

/** Minimal org display info resolved on demand for bill rows (name + logo). */
export interface OrgSummary {
  name: string;
  /** Short-lived presigned logo URL, or null when the org has no logo set. */
  logoUrl: string | null;
}

/**
 * In-memory organization cache — the "memory" behind {@link OrgNamePipe}.
 *
 * Bill rows carry only an `organizationId`, never the organizer name or logo.
 * Instead of pre-fetching the whole org list (the old `size:100` call), this root
 * singleton resolves each org on demand and remembers it: the first request for an
 * id seeds a placeholder signal and fires a single `getOrganizationById`; every
 * later request — across tables and across navigations — reuses the cached signal,
 * so each id is fetched at most once.
 */
@Injectable({ providedIn: 'root' })
export class OrgNameCacheService {
  private organizationService = inject(OrganizationService);

  // id → live org-summary signal. The entry is created synchronously on first
  // access, which also dedupes concurrent lookups for the same id (one HTTP call).
  private readonly orgs = new Map<number, WritableSignal<OrgSummary>>();

  /**
   * Resolve an organization's display summary. Returns a signal holding an
   * `Org #id` placeholder (no logo) until the lookup lands, then updating to the
   * real name and logo. The fetch runs only on the first miss; a failed lookup
   * keeps the placeholder.
   */
  resolve(id: number): Signal<OrgSummary> {
    let org = this.orgs.get(id);
    if (!org) {
      org = signal<OrgSummary>({ name: `Org #${id}`, logoUrl: null });
      this.orgs.set(id, org);
      this.organizationService.getOrganizationById(id).subscribe({
        next: (o) => org!.set({ name: o.organizerName, logoUrl: o.logoUrl ?? null }),
        error: () => {
          /* non-fatal: keep the `Org #id` placeholder */
        },
      });
    }
    return org;
  }
}
