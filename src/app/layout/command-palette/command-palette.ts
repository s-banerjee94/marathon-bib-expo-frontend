import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { CommandPaletteService, CommandResult } from '../../core/services/command-palette.service';

/**
 * Global Cmd/Ctrl+K command palette. A modal, centered overlay that searches
 * events, organizations, users and participants as you type. Selection is driven
 * by the keyboard (↑/↓ move, Enter opens, Esc closes) and the mouse; all of the
 * search/state logic lives in {@link CommandPaletteService}, so this component
 * only renders results and translates key/pointer input into selection.
 */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, IconFieldModule, InputIconModule, InputTextModule, ProgressBarModule],
  templateUrl: './command-palette.html',
})
export class CommandPalette {
  protected readonly palette = inject(CommandPaletteService);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly scrollArea = viewChild<ElementRef<HTMLElement>>('scrollArea');

  protected readonly activeIndex = signal(0);

  /** True once the query is long enough to query the backend (mirrors the service floor). */
  protected readonly canSearch = computed(() => this.palette.query().trim().length >= 2);

  /** Results regrouped for display, each row annotated with its flat index for highlighting. */
  protected readonly displayGroups = computed(() => {
    let index = 0;
    return this.palette.results().map((group) => ({
      ...group,
      results: group.results.map((result) => ({ ...result, flatIndex: index++ })),
    }));
  });

  constructor() {
    // A fresh result set always re-anchors the highlight to the first row.
    effect(() => {
      this.palette.results();
      this.activeIndex.set(0);
    });

    // Keep the highlighted row visible as the selection moves with the keyboard.
    effect(() => {
      const index = this.activeIndex();
      setTimeout(() => {
        const container = this.scrollArea()?.nativeElement;
        container?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
      });
    });
  }

  protected onVisibleChange(visible: boolean): void {
    if (!visible) this.palette.close();
  }

  protected onShow(): void {
    this.searchInput()?.nativeElement.focus();
  }

  protected onInput(event: Event): void {
    this.palette.search((event.target as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const results = this.palette.flatResults();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (results.length) this.activeIndex.update((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (results.length) this.activeIndex.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const result = results[this.activeIndex()];
        if (result) this.palette.navigateTo(result);
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.palette.close();
        break;
    }
  }

  protected select(result: CommandResult): void {
    this.palette.navigateTo(result);
  }
}
