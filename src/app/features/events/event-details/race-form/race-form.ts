import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { Race, CreateRaceRequest, UpdateRaceRequest } from '../../../../core/models/race.model';
import { RaceService } from '../../../../core/services/race.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { buildDirtyPatch, shouldShowError } from '../../../../shared/utils/form.utils';

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
  private raceService = inject(RaceService);
  private errorHandler = inject(ErrorHandlerService);

  isEditMode = signal(false);
  isSubmitting = signal(false);
  readonly inputSize = FORM_INPUT_SIZE;
  readonly shouldShowError = shouldShowError;

  private eventId!: number;
  private raceId: number | null = null;

  formData = { raceName: '', raceDescription: '' };

  ngOnInit(): void {
    const data = this.config.data as { race?: Race | null; eventId: number };
    const race = data?.race ?? null;
    this.eventId = data.eventId;
    this.raceId = race?.id ?? null;
    this.isEditMode.set(!!race);
    this.formData = {
      raceName: race?.raceName ?? '',
      raceDescription: race?.raceDescription ?? '',
    };
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) return;

    if (this.isEditMode()) {
      const patch = buildDirtyPatch<UpdateRaceRequest>(form, this.formData);

      if (!Object.keys(patch).length) {
        this.ref.close();
        return;
      }

      this.isSubmitting.set(true);
      this.raceService.updateRace(this.eventId, this.raceId!, patch).subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.ref.close(result);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.errorHandler.showError(error, 'Failed to update race');
        },
      });
      return;
    }

    this.isSubmitting.set(true);
    this.raceService.createRace(this.eventId, this.formData as CreateRaceRequest).subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        this.ref.close(result);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error, 'Failed to create race');
      },
    });
  }

  onCancel(): void {
    this.ref.close();
  }
}
