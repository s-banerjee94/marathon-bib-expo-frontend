import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { Category } from '../../../core/models/category.model';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

@Component({
  selector: 'app-category-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
  ],
  templateUrl: './category-form.html',
  styleUrl: './category-form.css',
})
export class CategoryForm implements OnInit {
  private fb = inject(FormBuilder);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  categoryForm!: FormGroup;
  isEditMode = signal(false);
  category = signal<Category | null>(null);

  readonly inputSize = FORM_INPUT_SIZE;

  ngOnInit(): void {
    this.category.set(this.config.data?.category || null);
    this.isEditMode.set(!!this.category());
    this.initForm();
  }

  initForm(): void {
    const category = this.category();

    this.categoryForm = this.fb.group({
      categoryName: [
        category?.categoryName || '',
        [Validators.required, Validators.maxLength(200), Validators.minLength(2)],
      ],
      description: [category?.description || '', [Validators.maxLength(1000)]],
    });
  }

  onSubmit(): void {
    if (this.categoryForm.valid) {
      this.ref.close(this.categoryForm.value);
    }
  }

  onCancel(): void {
    this.ref.close();
  }
}
