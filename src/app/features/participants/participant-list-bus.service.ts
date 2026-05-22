import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Participant } from '../../core/models/participant.model';

export type ParticipantMutation =
  | { readonly action: 'created'; readonly participant: Participant }
  | { readonly action: 'updated'; readonly participant: Participant };

@Injectable({ providedIn: 'root' })
export class ParticipantListBus {
  private readonly mutationSubject = new Subject<ParticipantMutation>();
  readonly mutations$: Observable<ParticipantMutation> = this.mutationSubject.asObservable();
  publish(mutation: ParticipantMutation): void {
    this.mutationSubject.next(mutation);
  }
}
