import { Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { OrganizationService } from '../../core/services/organization.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { MobileTabBar, TabItem } from '../../shared/components/mobile-tab-bar/mobile-tab-bar';
import { OrganizationAccountState } from './organization-account-state.service';

const DEFAULT_TAB = 'account';

/**
 * Organization "account" page shell. Serves two audiences:
 *  - ORGANIZER_ADMIN (route `/organization`, no id): loads their own organization.
 *  - ROOT/ADMIN (route `/organizations/:id/edit`): loads any organization by id.
 *
 * Loads the organization once and shares it via `OrganizationAccountState`; the
 * Account and Billing tabs are URL-driven routed children (mirrors event-details
 * and platform-billing), so switching tabs changes the route.
 */
@Component({
  selector: 'app-organization-account',
  standalone: true,
  imports: [
    TabsModule,
    ButtonModule,
    SkeletonModule,
    ConfirmPopupModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MobileTabBar,
  ],
  providers: [OrganizationAccountState, ConfirmationService],
  templateUrl: './organization-account.html',
  styleUrl: './organization-account.css',
})
export class OrganizationAccount implements OnInit {
  private organizationService = inject(OrganizationService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private confirmationService = inject(ConfirmationService);
  private authService = inject(AuthService);
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(OrganizationAccountState);

  // ROOT/ADMIN edit any org (and its governance fields); an ORGANIZER_ADMIN edits
  // their own org. Only used here for the page heading copy.
  readonly canEditGovernance = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

  readonly organization = this.state.organization;
  isLoading = signal(true);
  isDeleting = signal(false);

  // Set from the route param when ROOT/ADMIN edit a specific org; null = "my org".
  private orgId: number | null = null;

  readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_TAB),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_TAB },
  );

  readonly tabs: TabItem[] = [
    { id: 'account', label: 'Account', icon: 'pi-building' },
    { id: 'settings', label: 'Settings', icon: 'pi-cog' },
    { id: 'billing', label: 'Billing', icon: 'pi-receipt' },
  ];

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.orgId = idParam ? Number(idParam) : null;
    this.loadOrganization();
  }

  private loadOrganization(): void {
    this.isLoading.set(true);
    const request$ =
      this.orgId != null
        ? this.organizationService.getOrganizationById(this.orgId)
        : this.organizationService.getCurrentUserOrganization();

    request$.subscribe({
      next: (org) => {
        this.state.setOrganization(org);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onTabChange(tabId: string): void {
    this.router.navigate([tabId], { relativeTo: this.route });
  }

  goBack(): void {
    this.location.back();
  }

  // ROOT/ADMIN only. Permanent hard delete; the backend rejects (400) when the
  // organization still has events. On success we leave this page for the list.
  onDelete(event: Event): void {
    const org = this.organization();
    if (!org) return;

    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: `Delete "${org.organizerName}"? This permanently removes the organization and all of its users, and cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger',
      },
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      accept: () => {
        this.isDeleting.set(true);
        this.organizationService.deleteOrganization(org.id).subscribe({
          next: () => {
            this.isDeleting.set(false);
            this.toast.success(
              `Organization "${org.organizerName}" deleted successfully`,
              'Deleted',
            );
            this.router.navigate(['/organizations']);
          },
          error: (error) => {
            this.isDeleting.set(false);
            this.errorHandler.showError(error);
          },
        });
      },
    });
  }
}
