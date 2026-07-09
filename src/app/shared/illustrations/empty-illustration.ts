import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NoEvents } from './no-events';
import { NoOrganizations } from './no-organizations';
import { NoParticipants } from './no-participants';
import { NoUsers } from './no-users';
import { NoSearchResults } from './no-search-results';
import { NoNotifications } from './no-notifications';
import { AllCaughtUp } from './all-caught-up';
import { ImportFailed } from './import-failed';
import { NoData } from './no-data';
import { NoTemplates } from './no-templates';
import { NoCampaigns } from './no-campaigns';
import { NoGoodies } from './no-goodies';

/** Every empty-state illustration in the library, keyed by name. */
export type EmptyIllustrationName =
  | 'no-events'
  | 'no-organizations'
  | 'no-participants'
  | 'no-users'
  | 'no-search-results'
  | 'no-notifications'
  | 'all-caught-up'
  | 'import-failed'
  | 'no-data'
  | 'no-templates'
  | 'no-campaigns'
  | 'no-goodies';

/**
 * Renders an empty-state illustration by name. Lets generic shells (list-shell,
 * mobile-card-list) and one-off empty states pick an illustration without each
 * importing every leaf component. Falls back to `no-data` for anything unmapped.
 */
@Component({
  selector: 'app-empty-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NoEvents,
    NoOrganizations,
    NoParticipants,
    NoUsers,
    NoSearchResults,
    NoNotifications,
    AllCaughtUp,
    ImportFailed,
    NoData,
    NoTemplates,
    NoCampaigns,
    NoGoodies,
  ],
  template: `
    @switch (name()) {
      @case ('no-events') {
        <app-illustration-no-events [size]="size()" />
      }
      @case ('no-organizations') {
        <app-illustration-no-organizations [size]="size()" />
      }
      @case ('no-participants') {
        <app-illustration-no-participants [size]="size()" />
      }
      @case ('no-users') {
        <app-illustration-no-users [size]="size()" />
      }
      @case ('no-search-results') {
        <app-illustration-no-search-results [size]="size()" />
      }
      @case ('no-notifications') {
        <app-illustration-no-notifications [size]="size()" />
      }
      @case ('all-caught-up') {
        <app-illustration-all-caught-up [size]="size()" />
      }
      @case ('import-failed') {
        <app-illustration-import-failed [size]="size()" />
      }
      @case ('no-templates') {
        <app-illustration-no-templates [size]="size()" />
      }
      @case ('no-campaigns') {
        <app-illustration-no-campaigns [size]="size()" />
      }
      @case ('no-goodies') {
        <app-illustration-no-goodies [size]="size()" />
      }
      @default {
        <app-illustration-no-data [size]="size()" />
      }
    }
  `,
})
export class EmptyIllustration {
  readonly name = input.required<EmptyIllustrationName>();
  readonly size = input(96);
}
