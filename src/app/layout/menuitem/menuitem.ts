import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { AppMenuItem } from '../../shared/models/menu.model';
import { LayoutService } from '../../core/services/layout.service';
import { injectIsMobile } from '../../shared/utils/responsive.utils';

@Component({
  selector: 'app-menuitem',
  standalone: true,
  imports: [RouterModule, RippleModule, TooltipModule],
  templateUrl: './menuitem.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuitemComponent {
  layoutService = inject(LayoutService);
  item = input.required<AppMenuItem>();
  // Rail mode (desktop static + collapsed) replaces labels with hover tooltips.
  private isMobile = injectIsMobile(991);
  showTooltip = computed(() => this.layoutService.isSidebarCollapsed() && !this.isMobile());

  onItemClick(): void {
    if (this.layoutService.isMobile()) {
      this.layoutService.hideMenu();
    }
  }
}
