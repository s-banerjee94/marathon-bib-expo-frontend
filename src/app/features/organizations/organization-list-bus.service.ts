import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Organization } from '../../core/models/organization.model';

export type OrganizationMutation =
  | { readonly action: 'created'; readonly organization: Organization }
  | { readonly action: 'updated'; readonly organization: Organization };

// Lets OrganizationForm — whether rendered via dialog (desktop) or as a routed component
// (mobile) — push successful create/update results back to OrganizationList. The list
// updates the table locally instead of refetching, so page/filters/sort survive the
// round-trip.
@Injectable({ providedIn: 'root' })
export class OrganizationListBus {
  private readonly mutationSubject = new Subject<OrganizationMutation>();
  readonly mutations$: Observable<OrganizationMutation> = this.mutationSubject.asObservable();

  publish(mutation: OrganizationMutation): void {
    this.mutationSubject.next(mutation);
  }
}
