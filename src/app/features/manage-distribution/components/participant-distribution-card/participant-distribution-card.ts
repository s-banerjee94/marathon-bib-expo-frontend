import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/user.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';

@Component({
  selector: 'app-participant-distribution-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, DefaultValuePipe],
  templateUrl: './participant-distribution-card.html',
  styleUrl: './participant-distribution-card.css',
})
export class ParticipantDistributionCard {
  private authService = inject(AuthService);

  bibNumber = input.required<string>();
  fullName = input<string | undefined>(undefined);
  gender = input<string | undefined>(undefined);
  chipNumber = input<string | undefined>(undefined);
  phoneNumber = input<string | undefined>(undefined);
  email = input<string | undefined>(undefined);
  raceName = input<string | undefined>(undefined);
  categoryName = input<string | undefined>(undefined);

  canNavigate = computed(() =>
    this.authService.hasAnyRole([
      UserRole.ROOT,
      UserRole.ADMIN,
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ]),
  );
}
