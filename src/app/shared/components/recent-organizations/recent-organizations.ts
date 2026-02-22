import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Organization } from '../../../core/models/organization.model';

@Component({
  selector: 'app-recent-organizations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, CardModule, SkeletonModule, TableModule, TagModule],
  templateUrl: './recent-organizations.html',
})
export class RecentOrganizations {
  organizations = input<Organization[]>([]);
  isLoading = input<boolean>(false);
  viewAll = output<void>();
}
