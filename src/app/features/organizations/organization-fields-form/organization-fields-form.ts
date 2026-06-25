import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule, ControlContainer, NgForm } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { OrganizationFieldsModel } from '../../../core/models/organization.model';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

/**
 * Contact, address, and business fields for an organization — the markup shared
 * by the create dialog (`OrganizationForm`) and the edit page
 * (`OrganizationAccountDetails`). It owns nothing but the inputs; the parent
 * supplies the surrounding layout, the governance/subscription section, and the
 * submit handling.
 *
 * Template-driven sub-form: `viewProviders` re-uses the parent `NgForm` as the
 * `ControlContainer`, so every `ngModel` here registers into the parent form.
 * That keeps `parentForm.invalid`/`.controls['organizerName'].dirty` working —
 * the edit page's dirty-patch save depends on it. The model is mutated in place
 * (objects are by reference), so no two-way output is needed.
 */
@Component({
  selector: 'app-organization-fields-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputTextModule, FloatLabelModule, MessageModule],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  host: { class: 'block' },
  templateUrl: './organization-fields-form.html',
  styleUrl: './organization-fields-form.css',
})
export class OrganizationFieldsForm {
  readonly model = input.required<OrganizationFieldsModel>();
  /** Parent form's `submitted` flag, so errors also surface on a submit attempt. */
  readonly submitted = input<boolean>(false);

  readonly inputSize = FORM_INPUT_SIZE;
  protected readonly shouldShowError = shouldShowError;
}
