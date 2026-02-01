import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { LayoutService } from '../../core/services/layout.service';
import { MenuComponent } from '../menu/menu';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, MenuComponent],
  templateUrl: './sidebar.html',
})
export class SidebarComponent implements OnDestroy {
  private router = inject(Router);
  private el = inject(ElementRef);
  layoutService = inject(LayoutService);

  private routerSubscription: Subscription;

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
