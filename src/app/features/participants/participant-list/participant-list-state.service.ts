import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LookupSearchType, Participant } from '../../../core/models/participant.model';
import { Race, Category } from '../../../core/models/event.model';
import { ParticipantListBus, ParticipantMutation } from '../participant-list-bus.service';

/**
 * Owns the participant list's data for the lifetime of the Participants page (it is
 * provided by the host, not the table tab). Because the standalone page opens the
 * details/create dialogs via *sibling routes*, the `ParticipantTableTab` inside the
 * router-outlet is destroyed while a dialog is open and re-created on close. Holding
 * the data here lets the re-created tab restore instantly from cache instead of
 * refetching — so closing a dialog never "refreshes" the list.
 *
 * It is also the single subscriber to {@link ParticipantListBus}: a create/edit made
 * while the tab is torn down still lands in this cache (the whole record is patched in
 * place by bib number), so it is already present when the tab restores.
 */
@Injectable()
export class ParticipantListState {
  private readonly bus = inject(ParticipantListBus);

  // ----- cross-tab reload trigger (e.g., after a batch import completes) -----
  private reloadTriggerSignal = signal(0);
  readonly reloadTrigger = this.reloadTriggerSignal.asReadonly();

  triggerReload(): void {
    this.reloadTriggerSignal.update((v) => v + 1);
  }

  // ----- persistent list cache (survives table-tab re-creation) -----
  readonly participants = signal<Participant[]>([]);
  readonly totalCount = signal<number>(0);
  readonly hasMore = signal<boolean>(true);
  lastEvaluatedKey: string | undefined = undefined;

  // search state (two-way bound by the table tab)
  readonly selectedSearchType = signal<LookupSearchType>('NAME');
  readonly searchValue = signal<string>('');
  readonly dropdownSelectedItem = signal<string>('');
  readonly isSearchMode = signal<boolean>(false);

  // event reference data (races/categories for the search dropdowns)
  readonly races = signal<Race[]>([]);
  readonly categories = signal<Category[]>([]);

  // The event the cache currently holds; undefined until the first load.
  private loadedEventId: number | undefined = undefined;

  constructor() {
    // Single owner of bus mutations so an edit/create made while the table tab is
    // destroyed (its dialog open via a sibling route) still updates the cache.
    this.bus.mutations$
      .pipe(takeUntilDestroyed())
      .subscribe((mutation) => this.applyMutation(mutation));
  }

  /** True when the cache already holds this event's data (tab re-created, not a new event). */
  isCachedFor(eventId: number): boolean {
    return this.loadedEventId === eventId;
  }

  /** Marks the cache as owned by this event — called when a fresh load begins. */
  markLoaded(eventId: number): void {
    this.loadedEventId = eventId;
  }

  /** Clears the cached list, search and reference state (used on a genuine event switch). */
  resetCache(): void {
    this.participants.set([]);
    this.totalCount.set(0);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.selectedSearchType.set('NAME');
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.isSearchMode.set(false);
    this.races.set([]);
    this.categories.set([]);
    this.loadedEventId = undefined;
  }

  private applyMutation(mutation: ParticipantMutation): void {
    const current = this.participants();
    if (mutation.action === 'created') {
      this.participants.set([mutation.participant, ...current]);
      this.totalCount.update((count) => count + 1);
      return;
    }

    // 'updated' — reconcile the whole record into its row in place, but only when
    // the row is present AND its data actually changed. This covers both dialog
    // edits and the dialog *reloading* a record someone changed elsewhere (e.g. via
    // a shared link); skipping no-op replacements avoids needlessly churning the table.
    const incoming = mutation.participant;
    const index = current.findIndex((p) => p.bibNumber === incoming.bibNumber);
    if (index === -1) return;
    if (JSON.stringify(current[index]) === JSON.stringify(incoming)) return;
    const next = [...current];
    next[index] = incoming;
    this.participants.set(next);
  }
}
