import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { AvatarModule } from 'primeng/avatar';
import { FloatLabelModule } from 'primeng/floatlabel';
import { PageableResponse } from '../../core/models/api.model';
import { User } from '../../core/models/user.model';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { UserService } from '../../core/services/user.service';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';
import { HighlightPipe } from '../../shared/pipes/highlight.pipe';

/**
 * Reusable User Autocomplete Selector — mirrors OrganizationSelector.
 *
 * Pass `organizationId` to scope the search to one org; omit it (or pass null
 * / undefined) for a system-wide search. When `organizationId` changes any
 * currently-selected user is cleared and `usernameChange` emits `null`, since
 * the previous pick is no longer guaranteed to exist in the new scope.
 */
@Component({
  selector: 'app-user-selector',
  imports: [
    CommonModule,
    FormsModule,
    AutoCompleteModule,
    AvatarModule,
    FloatLabelModule,
    HighlightPipe,
  ],
  templateUrl: './user-selector.html',
})
export class UserSelector {
  label = input<string>('User');
  placeholder = input<string>('Type to search users...');
  disabled = input<boolean>(false);
  required = input<boolean>(false);
  fluid = input<boolean>(true);
  showFloatLabel = input<boolean>(true);
  size = input<'small' | 'large'>(FORM_INPUT_SIZE);
  inputId = input<string>('userAutocomplete');
  // Optional org scope. Null/undefined = search every user the caller is
  // authorised to see; a number = restrict to that org.
  organizationId = input<number | null | undefined>(undefined);

  usernameChange = output<string | null>();

  protected readonly autocompleteDelay = 300;
  protected userSuggestions = signal<User[]>([]);
  protected selectedUser = signal<User | null>(null);
  protected currentSearchTerm = signal<string>('');
  private hasLoadedInitial = false;

  private userService = inject(UserService);
  private errorHandler = inject(ErrorHandlerService);

  constructor() {
    // Reset suggestions + selection whenever the org scope changes. Wrap the
    // mutation in untracked() so the effect doesn't observe its own writes
    // and re-fire.
    effect(() => {
      this.organizationId();
      untracked(() => {
        const hadSelection = this.selectedUser() !== null;
        this.selectedUser.set(null);
        this.userSuggestions.set([]);
        this.hasLoadedInitial = false;
        if (hadSelection) {
          this.usernameChange.emit(null);
        }
      });
    });
  }

  onUserSearch(event: { query: string }): void {
    const searchTerm = event.query?.trim() ?? '';
    this.currentSearchTerm.set(searchTerm);
    // Re-open with the cached initial list — no need to refetch.
    if (!searchTerm && this.hasLoadedInitial) {
      return;
    }
    this.fetchUsers(searchTerm);
  }

  onUserSelect(event: AutoCompleteSelectEvent): void {
    const user = event.value as User | undefined;
    if (!user) return;
    this.selectedUser.set(user);
    this.usernameChange.emit(user.username);
  }

  onUserClear(): void {
    this.selectedUser.set(null);
    this.currentSearchTerm.set('');
    this.usernameChange.emit(null);
  }

  protected getInitials(user: User): string {
    const source = (user.fullName?.trim() || user.username?.trim()) ?? '?';
    const words = source.split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  private fetchUsers(searchTerm: string): void {
    const orgId = this.organizationId();
    this.userService
      .searchUsers({
        page: 0,
        size: 50,
        search: searchTerm,
        organizationId: orgId ?? undefined,
        sort: ['fullName,asc'],
      })
      .subscribe({
        next: (response: PageableResponse<User>) => {
          this.userSuggestions.set(response.content);
          if (!searchTerm) this.hasLoadedInitial = true;
        },
        error: (error) => this.errorHandler.showError(error, 'Failed to search users'),
      });
  }
}
