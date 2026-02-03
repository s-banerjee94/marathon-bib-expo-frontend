import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { $t, updatePreset, updateSurfacePalette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import Lara from '@primeuix/themes/lara';
import Material from '@primeuix/themes/material';
import Nora from '@primeuix/themes/nora';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';

export interface LayoutConfig {
  preset: string;
  primary: string;
  surface: string | null;
  darkTheme: boolean;
  menuMode: 'static' | 'overlay';
}

export interface LayoutState {
  staticMenuDesktopInactive: boolean;
  overlayMenuActive: boolean;
  mobileMenuActive: boolean;
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
  menuMode: 'static',
};

const DEFAULT_LAYOUT_STATE: LayoutState = {
  staticMenuDesktopInactive: false,
  overlayMenuActive: false,
  mobileMenuActive: false,
};

const PRESETS = {
  Aura,
  Lara,
  Material,
  Nora,
} as const;

type PresetKey = keyof typeof PRESETS;

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  layoutConfig = signal<LayoutConfig>(this.loadConfig());
  layoutState = signal<LayoutState>(DEFAULT_LAYOUT_STATE);
  isDarkTheme = computed(() => this.layoutConfig().darkTheme);
  selectedPrimary = computed(() => this.layoutConfig().primary);
  selectedSurface = computed(() => this.layoutConfig().surface);
  selectedPreset = computed(() => this.layoutConfig().preset);
  menuMode = computed(() => this.layoutConfig().menuMode);
  isSidebarActive = computed(() => {
    const state = this.layoutState();
    const config = this.layoutConfig();

    if (this.isDesktop()) {
      return config.menuMode === 'static' && !state.staticMenuDesktopInactive;
    }
    return state.overlayMenuActive || state.mobileMenuActive;
  });
  presetOptions = Object.keys(PRESETS);
  surfaces: SurfacePalette[] = [
    {
      name: 'slate',
      palette: {
        0: '#ffffff',
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
        950: '#020617',
      },
    },
    {
      name: 'gray',
      palette: {
        0: '#ffffff',
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
        950: '#030712',
      },
    },
    {
      name: 'zinc',
      palette: {
        0: '#ffffff',
        50: '#fafafa',
        100: '#f4f4f5',
        200: '#e4e4e7',
        300: '#d4d4d8',
        400: '#a1a1aa',
        500: '#71717a',
        600: '#52525b',
        700: '#3f3f46',
        800: '#27272a',
        900: '#18181b',
        950: '#09090b',
      },
    },
    {
      name: 'neutral',
      palette: {
        0: '#ffffff',
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#e5e5e5',
        300: '#d4d4d4',
        400: '#a3a3a3',
        500: '#737373',
        600: '#525252',
        700: '#404040',
        800: '#262626',
        900: '#171717',
        950: '#0a0a0a',
      },
    },
    {
      name: 'stone',
      palette: {
        0: '#ffffff',
        50: '#fafaf9',
        100: '#f5f5f4',
        200: '#e7e5e4',
        300: '#d6d3d1',
        400: '#a8a29e',
        500: '#78716c',
        600: '#57534e',
        700: '#44403c',
        800: '#292524',
        900: '#1c1917',
        950: '#0c0a09',
      },
    },
    {
      name: 'soho',
      palette: {
        0: '#ffffff',
        50: '#ececec',
        100: '#dedfdf',
        200: '#c4c4c6',
        300: '#adaeb0',
        400: '#97979b',
        500: '#7f8084',
        600: '#6a6b70',
        700: '#55565b',
        800: '#3f4046',
        900: '#2c2c34',
        950: '#16161d',
      },
    },
    {
      name: 'viva',
      palette: {
        0: '#ffffff',
        50: '#f3f3f3',
        100: '#e7e7e8',
        200: '#cfd0d0',
        300: '#b7b8b9',
        400: '#9fa1a1',
        500: '#87898a',
        600: '#6e7173',
        700: '#565a5b',
        800: '#3e4244',
        900: '#262b2c',
        950: '#0e1315',
      },
    },
    {
      name: 'ocean',
      palette: {
        0: '#ffffff',
        50: '#fbfcfc',
        100: '#F7F9F8',
        200: '#EFF3F2',
        300: '#DADEDD',
        400: '#B1B7B6',
        500: '#828787',
        600: '#5F7274',
        700: '#415B61',
        800: '#29444E',
        900: '#183240',
        950: '#0c1920',
      },
    },
  ];
  primaryColors = computed<SurfacePalette[]>(() => {
    const presetPalette = PRESETS[this.layoutConfig().preset as PresetKey]?.primitive;
    const colors = [
      'emerald',
      'green',
      'lime',
      'orange',
      'amber',
      'yellow',
      'teal',
      'cyan',
      'sky',
      'blue',
      'indigo',
      'violet',
      'purple',
      'fuchsia',
      'pink',
      'rose',
    ];
    const palettes: SurfacePalette[] = [{ name: 'noir', palette: {} }];

    colors.forEach((color) => {
      palettes.push({
        name: color,
        palette: presetPalette?.[color as keyof typeof presetPalette] as SurfacePalette['palette'],
      });
    });

    return palettes;
  });
  private platformId = inject(PLATFORM_ID);
  private initialized = false;

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

    if (isPlatformBrowser(this.platformId)) {
      this.applyDarkMode(this.layoutConfig());
    }
  }

  initializeTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.applyPreset(this.layoutConfig().preset);
    }
  }

  toggleDarkMode(): void {
    this.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
  }

  onMenuToggle(): void {
    if (this.isDesktop()) {
      this.layoutState.update((state) => ({
        ...state,
        staticMenuDesktopInactive: !state.staticMenuDesktopInactive,
      }));
    } else {
      this.layoutState.update((state) => ({
        ...state,
        mobileMenuActive: !state.mobileMenuActive,
      }));
    }
  }

  hideMenu(): void {
    this.layoutState.update((state) => ({
      ...state,
      overlayMenuActive: false,
      mobileMenuActive: false,
    }));
  }

  isDesktop(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    return window.innerWidth > 991;
  }

  isMobile(): boolean {
    return !this.isDesktop();
  }

  updateColors(type: 'primary' | 'surface', color: SurfacePalette): void {
    if (type === 'primary') {
      this.layoutConfig.update((state) => ({ ...state, primary: color.name }));
      updatePreset(this.getPresetExt());
    } else if (type === 'surface') {
      this.layoutConfig.update((state) => ({ ...state, surface: color.name }));
      updateSurfacePalette(color.palette);
    }
  }

  applyPreset(presetName: string): void {
    this.layoutConfig.update((state) => ({ ...state, preset: presetName }));
    const preset = PRESETS[presetName as PresetKey];
    const surfacePalette = this.surfaces.find((s) => s.name === this.selectedSurface())?.palette;
    $t()
      .preset(preset)
      .preset(this.getPresetExt())
      .surfacePalette(surfacePalette)
      .use({ useDefaultOptions: true });
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

  private getPresetExt() {
    const color = this.primaryColors().find((c) => c.name === this.selectedPrimary());
    const preset = this.layoutConfig().preset;

    if (color?.name === 'noir') {
      return {
        semantic: {
          primary: {
            50: '{surface.50}',
            100: '{surface.100}',
            200: '{surface.200}',
            300: '{surface.300}',
            400: '{surface.400}',
            500: '{surface.500}',
            600: '{surface.600}',
            700: '{surface.700}',
            800: '{surface.800}',
            900: '{surface.900}',
            950: '{surface.950}',
          },
          colorScheme: {
            light: {
              primary: {
                color: '{primary.950}',
                contrastColor: '#ffffff',
                hoverColor: '{primary.800}',
                activeColor: '{primary.700}',
              },
              highlight: {
                background: '{primary.950}',
                focusBackground: '{primary.700}',
                color: '#ffffff',
                focusColor: '#ffffff',
              },
            },
            dark: {
              primary: {
                color: '{primary.50}',
                contrastColor: '{primary.950}',
                hoverColor: '{primary.200}',
                activeColor: '{primary.300}',
              },
              highlight: {
                background: '{primary.50}',
                focusBackground: '{primary.300}',
                color: '{primary.950}',
                focusColor: '{primary.950}',
              },
            },
          },
        },
      };
    }

    if (preset === 'Nora') {
      return {
        semantic: {
          primary: color?.palette,
          colorScheme: {
            light: {
              primary: {
                color: '{primary.600}',
                contrastColor: '#ffffff',
                hoverColor: '{primary.700}',
                activeColor: '{primary.800}',
              },
              highlight: {
                background: '{primary.600}',
                focusBackground: '{primary.700}',
                color: '#ffffff',
                focusColor: '#ffffff',
              },
            },
            dark: {
              primary: {
                color: '{primary.500}',
                contrastColor: '{surface.900}',
                hoverColor: '{primary.400}',
                activeColor: '{primary.300}',
              },
              highlight: {
                background: '{primary.500}',
                focusBackground: '{primary.400}',
                color: '{surface.900}',
                focusColor: '{surface.900}',
              },
            },
          },
        },
      };
    }

    return {
      semantic: {
        primary: color?.palette,
        colorScheme: {
          light: {
            primary: {
              color: '{primary.500}',
              contrastColor: '#ffffff',
              hoverColor: '{primary.600}',
              activeColor: '{primary.700}',
            },
            highlight: {
              background: '{primary.50}',
              focusBackground: '{primary.100}',
              color: '{primary.700}',
              focusColor: '{primary.800}',
            },
          },
          dark: {
            primary: {
              color: '{primary.400}',
              contrastColor: '{surface.900}',
              hoverColor: '{primary.300}',
              activeColor: '{primary.200}',
            },
            highlight: {
              background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
              focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
              color: 'rgba(255,255,255,.87)',
              focusColor: 'rgba(255,255,255,.87)',
            },
          },
        },
      },
    };
  }
}
