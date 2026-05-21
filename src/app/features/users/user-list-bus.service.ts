import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { User } from '../../core/models/user.model';

export type UserMutation =
  | { readonly action: 'created'; readonly user: User }
  | { readonly action: 'updated'; readonly user: User };

// Lets UserForm — whether rendered via dialog (desktop) or as a routed component (mobile) —
// push successful create/update results back to UserList. UserList updates the table locally
// instead of refetching, so page/filters/sort survive the round-trip.
@Injectable({ providedIn: 'root' })
export class UserListBus {
  private readonly mutationSubject = new Subject<UserMutation>();
  readonly mutations$: Observable<UserMutation> = this.mutationSubject.asObservable();

  publish(mutation: UserMutation): void {
    this.mutationSubject.next(mutation);
  }
}
