import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { Race } from '../../../core/models/race.model';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { shouldShowError } from '../../../shared/utils/form.utils';

@Component({
  selector: 'app-race-form',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
  ],
  templateUrl: './race-form.html',
  styleUrl: './race-form.css',
})
export class RaceForm implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  isEditMode = signal(false);
  readonly inputSize = FORM_INPUT_SIZE;
  readonly shouldShowError = shouldShowError;

  formData = { raceName: '', raceDescription: '' };

  ngOnInit(): void {
    const race = this.config.data?.race as Race | null;
    this.isEditMode.set(!!race);
    this.formData = {
      raceName: race?.raceName ?? '',
      raceDescription: race?.raceDescription ?? '',
    };
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) return;

    if (!this.isEditMode()) {
      this.ref.close(this.formData);
      return;
    }

    const patch = Object.fromEntries(
      Object.keys(this.formData)
        .filter((key) => form.controls[key]?.dirty)
        .map((key) => [key, this.formData[key as keyof typeof this.formData]]),
    );

    this.ref.close(Object.keys(patch).length ? patch : undefined);
  }

  onCancel(): void {
    this.ref.close();
  }
}
