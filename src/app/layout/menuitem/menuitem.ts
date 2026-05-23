import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostBinding,
  inject,
  input,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { AppMenuItem } from '../../shared/models/menu.model';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-menuitem',
  standalone: true,
  imports: [CommonModule, RouterModule, RippleModule, TooltipModule],
  templateUrl: './menuitem.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuitemComponent {
  layoutService = inject(LayoutService);
  item = input.required<AppMenuItem>();
  index = input<number>(0);
  parentKey = input<string>('');
  isActive = signal(false);
  isExpanded = signal(false);
  private router = inject(Router);

  constructor() {
    // Subscribe to navigation events for future route changes
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateActiveState((event as NavigationEnd).urlAfterRedirects);
      });

    // Use effect to check initial route after item input is available
    effect(() => {
      // Access item() to track it as a dependency
      const currentItem = this.item();
      if (currentItem) {
        this.updateActiveStateForItem(currentItem, this.router.url);
      }
    });
  }

  @HostBinding('class.layout-menuitem-root')
  get isRoot() {
    return !this.parentKey();
  }

  get key(): string {
    return this.parentKey() ? `${this.parentKey()}-${this.index()}` : String(this.index());
  }

  get hasSubmenu(): boolean {
    return !!this.item().items && this.item().items!.length > 0;
  }

  updateActiveState(url: string): void {
    this.updateActiveStateForItem(this.item(), url);
  }

  toggleSubmenu(event: Event): void {
    event.preventDefault();
    this.isExpanded.update((v) => !v);
  }

  onItemClick(event: Event): void {
    if (this.hasSubmenu) {
      this.toggleSubmenu(event);
    } else if (this.layoutService.isMobile()) {
      this.layoutService.hideMenu();
    }
  }

  private updateActiveStateForItem(item: AppMenuItem, url: string): void {
    const itemLink = item.routerLink;
    if (itemLink) {
      this.isActive.set(url === itemLink || url.startsWith(itemLink + '/'));
    }

    const hasSubmenu = !!item.items && item.items.length > 0;
    if (hasSubmenu) {
      const hasActiveChild = item.items!.some(
        (child) =>
          child.routerLink && (url === child.routerLink || url.startsWith(child.routerLink + '/')),
      );
      if (hasActiveChild) {
        this.isExpanded.set(true);
      }
    }
  }
}
