import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SelectButtonModule } from 'primeng/selectbutton';
import { BUTTON_SIZE } from '../../../../shared/constants/form.constants';

const DEFAULT_CHANNEL = 'sms';

@Component({
  selector: 'app-campaigns-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectButtonModule, RouterOutlet],
  templateUrl: './campaigns-section.html',
  styleUrl: './campaigns-section.css',
})
export class CampaignsSection {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly buttonSize = BUTTON_SIZE;

  protected readonly channels = [
    { label: 'SMS', value: 'sms' },
    { label: 'WhatsApp', value: 'whatsapp' },
    { label: 'Email', value: 'email' },
  ];

  protected readonly activeChannel = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_CHANNEL),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? DEFAULT_CHANNEL },
  );

  protected onChannelChange(channel: string): void {
    this.router.navigate([channel], { relativeTo: this.route });
  }
}
