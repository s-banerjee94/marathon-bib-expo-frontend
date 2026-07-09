import { Injectable, signal } from '@angular/core';
import { Organization } from '../../core/models/organization.model';

/**
 * Shares the loaded organization between the account shell (which fetches it) and
 * its routed tabs (Account details, Billing). Provided at the shell component, so
 * each account page gets its own instance. Mirrors `EventDetailsState`.
 */
@Injectable()
export class OrganizationAccountState {
  private readonly orgSignal = signal<Organization | null>(null);
  readonly organization = this.orgSignal.asReadonly();

  setOrganization(org: Organization): void {
    this.orgSignal.set(org);
  }
}
