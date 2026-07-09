import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import { Race, CreateRaceRequest, UpdateRaceRequest } from '../../../../core/models/race.model';
import { RaceService } from '../../../../core/services/race.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { buildDirtyPatch, shouldShowError } from '../../../../shared/utils/form.utils';
import {
  parseScheduledDateTime,
  toScheduledDate,
  toScheduledTime,
} from '../../../../shared/utils/campaign-schedule.utils';

interface RaceFormModel {
  raceName: string;
  raceDescription: string;
  // Single date+time control; split into the two local wall-clock strings on
  // submit (reportingDate yyyy-MM-dd + reportingTime HH:mm). No timezone math —
  // the server interprets the wall-clock in the parent event's timezone.
  reportingTime: Date | null;
}

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
    DatePickerModule,
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
  eventTimezone = signal<string>('');
  readonly inputSize = FORM_INPUT_SIZE;
  readonly shouldShowError = shouldShowError;

  private eventId!: number;
  private raceId: number | null = null;

  formData: RaceFormModel = { raceName: '', raceDescription: '', reportingTime: null };

  ngOnInit(): void {
    const data = this.config.data as {
      race?: Race | null;
      eventId: number;
      eventTimezone?: string;
    };
    const race = data?.race ?? null;
    this.eventId = data.eventId;
    this.raceId = race?.id ?? null;
    this.eventTimezone.set(data.eventTimezone ?? '');
    this.isEditMode.set(!!race);
    this.formData = {
      raceName: race?.raceName ?? '',
      raceDescription: race?.raceDescription ?? '',
      // Same wall-clock split codec the campaign forms use; a race may lack the
      // time half, which then defaults to midnight.
      reportingTime: parseScheduledDateTime(
        race?.reportingDate ?? undefined,
        race?.reportingTime || '00:00',
      ),
    };
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) return;

    // Both fields or neither — the picker yields a Date (both) or null (neither).
    const picked = this.formData.reportingTime;
    const reporting = picked
      ? { reportingDate: toScheduledDate(picked), reportingTime: toScheduledTime(picked) }
      : null;

    if (this.isEditMode()) {
      const patch = buildDirtyPatch<UpdateRaceRequest>(
        form,
        this.formData,
        new Set(['reportingTime']),
      );

      if (form.controls['reportingTime']?.dirty && reporting) {
        patch.reportingDate = reporting.reportingDate;
        patch.reportingTime = reporting.reportingTime;
      }

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
          this.errorHandler.showError(error);
        },
      });
      return;
    }

    const createRequest: CreateRaceRequest = {
      raceName: this.formData.raceName,
      raceDescription: this.formData.raceDescription,
      ...(reporting ?? {}),
    };

    this.isSubmitting.set(true);
    this.raceService.createRace(this.eventId, createRequest).subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        this.ref.close(result);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onCancel(): void {
    this.ref.close();
  }
}
