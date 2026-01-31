import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { LayoutService, SurfacePalette } from '../../core/services/layout.service';

@Component({
  selector: 'app-theme-configurator',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectButtonModule],
  templateUrl: './theme-configurator.html',
})
export class ThemeConfigurator implements OnInit {
  layoutService = inject(LayoutService);

  ngOnInit() {
    this.layoutService.initializeTheme();
  }

  updateColors(event: Event, type: 'primary' | 'surface', color: SurfacePalette): void {
    this.layoutService.updateColors(type, color);
    event.stopPropagation();
  }

  onPresetChange(preset: string): void {
    this.layoutService.applyPreset(preset);
  }
}
