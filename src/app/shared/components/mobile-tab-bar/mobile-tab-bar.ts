import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface TabItem {
  /** Stable identifier; matches the event-detail child route path (e.g. 'dashboard'). */
  id: string;
  /** Label shown in the expanded grid and used as the icon-row aria-label. */
  label: string;
  /** PrimeIcons class including the variant, e.g. 'pi-home'. */
  icon: string;
}

/**
 * Mobile-only bottom tab bar for the event-detail page. Below 768px it replaces the
 * desktop tab strip with a horizontally scrollable icon row plus a pinned chevron that
 * lifts a bottom sheet listing every tab as a 4-column grid. Scales to any tab count:
 * few tabs stretch to fill the row, more tabs scroll, and the sheet always shows all.
 *
 * Controlled component: the parent owns the active tab (read from the route) and passes
 * it via `activeId`; selecting a tab emits `tabChange` with the tab id.
 */
@Component({
  selector: 'app-mobile-tab-bar',
  templateUrl: './mobile-tab-bar.html',
  styleUrl: './mobile-tab-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class MobileTabBar {
  readonly tabs = input.required<TabItem[]>();
  readonly activeId = input<string | null>(null);
  readonly tabChange = output<string>();

  readonly isOpen = signal(false);

  private readonly scrollRow = viewChild<ElementRef<HTMLElement>>('scrollRow');

  constructor() {
    // On first render, bring the active tab into view so users see where they are.
    afterNextRender(() => {
      this.scrollRow()
        ?.nativeElement.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  select(tab: TabItem): void {
    this.tabChange.emit(tab.id);
    this.close();
  }

  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }
}
