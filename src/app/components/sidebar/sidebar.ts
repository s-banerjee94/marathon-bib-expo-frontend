import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { LayoutService } from '../../core/services/layout.service';
import { MenuComponent } from '../menu/menu';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, MenuComponent],
  templateUrl: './sidebar.html',
  animations: [
    trigger('sidebarSlide', [
      state('visible', style({ transform: 'translateX(0)' })),
      state('hidden', style({ transform: 'translateX(-100%)' })),
      transition('visible <=> hidden', animate('300ms cubic-bezier(0.4, 0, 0.2, 1)')),
    ]),
  ],
})
export class SidebarComponent implements OnDestroy {
  layoutService = inject(LayoutService);
  private router = inject(Router);
  private routerSubscription: Subscription;

  animationState = computed(() => (this.layoutService.isSidebarActive() ? 'visible' : 'hidden'));

  constructor() {
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.layoutService.isMobile()) {
          this.layoutService.hideMenu();
        }
      });
  }

  onSidebarClick(event: MouseEvent): void {
    // Prevent click from bubbling to overlay click handler
    event.stopPropagation();
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }
}
