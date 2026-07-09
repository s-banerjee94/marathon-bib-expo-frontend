import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import {
  AiAssistantMode,
  BorderRadiusMode,
  InputVariant,
  LayoutService,
  SurfacePalette,
} from '../../core/services/layout.service';

@Component({
  selector: 'app-theme-configurator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectButtonModule,
    ToggleSwitchModule,
    ButtonModule,
    DividerModule,
    TooltipModule,
  ],
  templateUrl: './theme-configurator.html',
})
export class ThemeConfigurator {
  layoutService = inject(LayoutService);

  updateColors(event: Event, type: 'primary' | 'surface', color: SurfacePalette): void {
    this.layoutService.updateColors(type, color);
    event.stopPropagation();
  }

  onPresetChange(preset: string): void {
    this.layoutService.applyPreset(preset);
  }

  onMenuModeChange(mode: 'static' | 'overlay'): void {
    this.layoutService.setMenuMode(mode);
  }

  onAiAssistantModeChange(mode: AiAssistantMode): void {
    this.layoutService.setAiAssistantMode(mode);
  }

  onFontScaleChange(scale: number): void {
    this.layoutService.setFontScale(scale);
  }

  onRippleChange(value: boolean): void {
    this.layoutService.setRipple(value);
  }

  onInputVariantChange(variant: InputVariant): void {
    this.layoutService.setInputVariant(variant);
  }

  onBorderRadiusChange(mode: BorderRadiusMode): void {
    this.layoutService.setBorderRadius(mode);
  }

  onFollowSystemChange(value: boolean): void {
    this.layoutService.setFollowSystem(value);
  }

  onReset(): void {
    this.layoutService.resetToDefaults();
  }
}
