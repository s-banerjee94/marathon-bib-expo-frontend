import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { Race } from '../../../core/models/race.model';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

@Component({
  selector: 'app-race-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
  private fb = inject(FormBuilder);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  raceForm!: FormGroup;
  isEditMode = signal(false);
  race = signal<Race | null>(null);

  readonly inputSize = FORM_INPUT_SIZE;

  ngOnInit(): void {
    this.race.set(this.config.data?.race || null);
    this.isEditMode.set(!!this.race());
    this.initForm();
  }

  initForm(): void {
    const race = this.race();

    this.raceForm = this.fb.group({
      raceName: [
        race?.raceName || '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
      ],
      raceDescription: [race?.raceDescription || '', [Validators.maxLength(500)]],
    });
  }

  onSubmit(): void {
    if (this.raceForm.valid) {
      this.ref.close(this.raceForm.value);
    }
  }

  onCancel(): void {
    this.ref.close();
  }
}
