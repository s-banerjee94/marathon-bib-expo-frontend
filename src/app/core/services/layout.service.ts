import { Injectable, effect, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';

export interface LayoutConfig {
  preset: string;
  primary: string;
  surface: string | null;
  darkTheme: boolean;
}

export interface SurfacePalette {
  name: string;
  palette: {
    0?: string;
    50?: string;
    100?: string;
    200?: string;
    300?: string;
    400?: string;
    500?: string;
    600?: string;
    700?: string;
    800?: string;
    900?: string;
    950?: string;
  };
}

const DEFAULT_CONFIG: LayoutConfig = {
  preset: 'Aura',
  primary: 'emerald',
  surface: null,
  darkTheme: false,
};

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private platformId = inject(PLATFORM_ID);
  private initialized = false;

  layoutConfig = signal<LayoutConfig>(this.loadConfig());

  isDarkTheme = computed(() => this.layoutConfig().darkTheme);
  getPrimary = computed(() => this.layoutConfig().primary);
  getSurface = computed(() => this.layoutConfig().surface);
  getPreset = computed(() => this.layoutConfig().preset);

  constructor() {
    effect(() => {
      const config = this.layoutConfig();

      if (!this.initialized || !config) {
        this.initialized = true;
        return;
      }

      this.applyDarkMode(config);
      this.saveConfig(config);
    });

    // Apply initial dark mode state
    if (isPlatformBrowser(this.platformId)) {
      this.applyDarkMode(this.layoutConfig());
    }
  }

  private loadConfig(): LayoutConfig {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(STORAGE_KEYS.LAYOUT_CONFIG);
      if (saved) {
        try {
          return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_CONFIG;
        }
      }
    }
    return DEFAULT_CONFIG;
  }

  private saveConfig(config: LayoutConfig): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEYS.LAYOUT_CONFIG, JSON.stringify(config));
    }
  }

  private applyDarkMode(config: LayoutConfig): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (config.darkTheme) {
      document.documentElement.classList.add('app-dark');
    } else {
      document.documentElement.classList.remove('app-dark');
    }
  }

  setDarkTheme(dark: boolean): void {
    this.layoutConfig.update((state) => ({ ...state, darkTheme: dark }));
  }

  setPrimary(primary: string): void {
    this.layoutConfig.update((state) => ({ ...state, primary }));
  }

  setSurface(surface: string): void {
    this.layoutConfig.update((state) => ({ ...state, surface }));
  }

  setPreset(preset: string): void {
    this.layoutConfig.update((state) => ({ ...state, preset }));
  }
}
