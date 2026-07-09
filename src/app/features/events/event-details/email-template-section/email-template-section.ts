import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-email-template-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './email-template-section.html',
  styleUrl: './email-template-section.css',
})
export class EmailTemplateSection {}
