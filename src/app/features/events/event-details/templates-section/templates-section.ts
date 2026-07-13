import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { SelectButtonModule } from 'primeng/selectbutton';
import { BUTTON_SIZE } from '../../../../shared/constants/form.constants';
import {
  activeChildRouteSignal,
  firstChildPath,
} from '../../../../shared/utils/active-route.utils';

const DEFAULT_CHANNEL = 'sms';

@Component({
  selector: 'app-templates-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectButtonModule, RouterOutlet],
  templateUrl: './templates-section.html',
  styleUrl: './templates-section.css',
})
export class TemplatesSection {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly buttonSize = BUTTON_SIZE;

  protected readonly channels = [
    { label: 'SMS', value: 'sms' },
    { label: 'WhatsApp', value: 'whatsapp' },
    { label: 'Email', value: 'email' },
  ];

  protected readonly activeChannel = activeChildRouteSignal(firstChildPath, DEFAULT_CHANNEL);

  protected onChannelChange(channel: string): void {
    this.router.navigate([channel], { relativeTo: this.route });
  }
}
