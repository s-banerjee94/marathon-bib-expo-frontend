import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { $t, updatePreset, updateSurfacePalette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import Lara from '@primeuix/themes/lara';
import Material from '@primeuix/themes/material';
import Nora from '@primeuix/themes/nora';
import { PrimeNG } from 'primeng/config';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { LocalStorageService } from './local-storage.service';

export type BorderRadiusMode = 'square' | 'default' | 'rounded';
export type InputVariant = 'outlined' | 'filled';
export type AiAssistantMode = 'overlay' | 'push' | 'popup';

const CONFIG_VERSION = 3;

export interface LayoutConfig {
  version: number;
  preset: string;
  primary: string;
  surface: string | null;
  darkTheme: boolean;
  menuMode: 'static' | 'overlay';
  fontScale: number;
  ripple: boolean;
  inputVariant: InputVariant;
  borderRadius: BorderRadiusMode;
  followSystem: boolean;
  aiAssistantMode: AiAssistantMode;
  // Desktop static mode only: when true the sidebar shows as an icon-only rail.
  sidebarCollapsed: boolean;
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
  version: CONFIG_VERSION,
  preset: 'Aura',
  primary: 'noir',
  surface: null,
  darkTheme: false,
  menuMode: 'static',
  fontScale: 14,
  ripple: true,
  inputVariant: 'outlined',
  borderRadius: 'default',
  followSystem: false,
  aiAssistantMode: 'push',
  sidebarCollapsed: false,
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

const BORDER_RADIUS_VALUES: Record<BorderRadiusMode, Record<string, string>> = {
  square: { xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
  default: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  rounded: {
    xs: '6px',
    sm: '10px',
    md: '14px',
    lg: '18px',
    xl: '24px',
  },
};

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  // Injects MUST be declared before any field that calls a method using them,
  // since class field initializers run in declaration order. `layoutConfig`
  // below calls `loadConfig()` which uses `this.storage`.
  private platformId = inject(PLATFORM_ID);
  private primengConfig = inject(PrimeNG);
  private storage = inject(LocalStorageService);
  private router = inject(Router);
  private document = inject(DOCUMENT);

  layoutConfig = signal<LayoutConfig>(this.loadConfig());
  layoutState = signal<LayoutState>(DEFAULT_LAYOUT_STATE);
  isDarkTheme = computed(() => this.layoutConfig().darkTheme);

  // Tracks the active URL so the shell/navbar can adapt to the public landing
  // (root path) vs. the authenticated app pages.
  // Seed from the real browser path — this service is constructed in an
  // APP_INITIALIZER, before the router resolves the first navigation, so
  // router.url is still '/' at that point and would wrongly flag every
  // hard-loaded deep route (e.g. /users) as the landing page.
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.document.location?.pathname ?? this.router.url },
  );
  /** True while the public marketing landing (root path) is showing. */
  isLandingRoute = computed(() => {
    const url = (this.currentUrl() ?? '/').split(/[?#]/)[0];
    return url === '/' || url === '';
  });
  // Bare public pages (login + public links like /s/:shortCode, /demo/:code)
  // render with no app shell — no navbar, sidebar, or layout chrome.
  private readonly publicPaths = [
    '/login',
    '/accept-invite',
    '/forgot-password',
    '/reset-password',
  ];
  /** True on bare public routes that render without any app shell. */
  isPublicRoute = computed(() => {
    const url = (this.currentUrl() ?? '/').split(/[?#]/)[0];
    return (
      this.publicPaths.includes(url) ||
      url === '/s' ||
      url.startsWith('/s/') ||
      url === '/demo' ||
      url.startsWith('/demo/')
    );
  });
  selectedPrimary = computed(() => this.layoutConfig().primary);
  selectedSurface = computed(() => this.layoutConfig().surface);
  selectedPreset = computed(() => this.layoutConfig().preset);
  menuMode = computed(() => this.layoutConfig().menuMode);
  fontScale = computed(() => this.layoutConfig().fontScale);
  rippleEnabled = computed(() => this.layoutConfig().ripple);
  inputVariant = computed(() => this.layoutConfig().inputVariant);
  borderRadius = computed(() => this.layoutConfig().borderRadius);
  followSystem = computed(() => this.layoutConfig().followSystem);
  aiAssistantMode = computed(() => this.layoutConfig().aiAssistantMode);
  isSidebarCollapsed = computed(() => this.layoutConfig().sidebarCollapsed);
  isNoirActive = computed(() => this.layoutConfig().primary === 'noir');
  isSidebarActive = computed(() => {
    const state = this.layoutState();
    const config = this.layoutConfig();

    if (this.isDesktop()) {
      if (config.menuMode === 'static') {
        return !state.staticMenuDesktopInactive;
      }
      // overlay mode on desktop: only visible when toggled open
      return state.overlayMenuActive;
    }
    // mobile: shown via overlay or mobile-menu flag
    return state.overlayMenuActive || state.mobileMenuActive;
  });
  presetOptions = Object.keys(PRESETS);
  menuModeOptions: { label: string; value: 'static' | 'overlay' }[] = [
    { label: 'Static', value: 'static' },
    { label: 'Overlay', value: 'overlay' },
  ];
  aiAssistantModeOptions: { label: string; value: AiAssistantMode }[] = [
    { label: 'Push', value: 'push' },
    { label: 'Overlay', value: 'overlay' },
    { label: 'Popup', value: 'popup' },
  ];
  inputVariantOptions: { label: string; value: InputVariant }[] = [
    { label: 'Outlined', value: 'outlined' },
    { label: 'Filled', value: 'filled' },
  ];
  borderRadiusOptions: { label: string; value: BorderRadiusMode }[] = [
    { label: 'Square', value: 'square' },
    { label: 'Default', value: 'default' },
    { label: 'Rounded', value: 'rounded' },
  ];
  fontScaleOptions: { label: string; value: number }[] = [
    { label: '12', value: 12 },
    { label: '13', value: 13 },
    { label: '14', value: 14 },
    { label: '15', value: 15 },
    { label: '16', value: 16 },
  ];
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
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;
  private initialized = false;

  constructor() {
    effect(() => {
      const config = this.layoutConfig();

      this.applyDarkMode(config);
      this.applyFontScale(config.fontScale);
      this.applyRipple(config.ripple);
      this.applyInputVariant(config.inputVariant);

      if (!this.initialized) {
        this.initialized = true;
        return;
      }

      this.saveConfig(config);
    });
  }

  initializeTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const config = this.layoutConfig();
    this.applyDarkMode(config);
    this.applyFontScale(config.fontScale);
    this.applyRipple(config.ripple);
    this.applyInputVariant(config.inputVariant);
    this.applyPreset(config.preset);
    this.applyBorderRadius(config.borderRadius);

    if (config.followSystem) {
      this.attachSystemDarkListener();
    }
  }

  toggleDarkMode(): void {
    const apply = () => {
      this.layoutConfig.update((state) => ({
        ...state,
        darkTheme: !state.darkTheme,
        followSystem: false,
      }));
      this.detachSystemDarkListener();
    };

    if (
      isPlatformBrowser(this.platformId) &&
      'startViewTransition' in document &&
      typeof (document as Document & { startViewTransition?: unknown }).startViewTransition ===
        'function'
    ) {
      (
        document as Document & { startViewTransition: (cb: () => void) => void }
      ).startViewTransition(apply);
    } else {
      apply();
    }
  }

  setMenuMode(mode: 'static' | 'overlay'): void {
    this.layoutConfig.update((state) => ({ ...state, menuMode: mode }));
  }

  setAiAssistantMode(mode: AiAssistantMode): void {
    this.layoutConfig.update((state) => ({ ...state, aiAssistantMode: mode }));
  }

  setFontScale(scale: number): void {
    this.layoutConfig.update((state) => ({ ...state, fontScale: scale }));
  }

  setRipple(value: boolean): void {
    this.layoutConfig.update((state) => ({ ...state, ripple: value }));
  }

  setInputVariant(variant: InputVariant): void {
    this.layoutConfig.update((state) => ({ ...state, inputVariant: variant }));
  }

  setBorderRadius(mode: BorderRadiusMode): void {
    this.layoutConfig.update((state) => ({ ...state, borderRadius: mode }));
    this.applyBorderRadius(mode);
  }

  setFollowSystem(value: boolean): void {
    this.layoutConfig.update((state) => ({ ...state, followSystem: value }));
    if (value) {
      this.attachSystemDarkListener();
      this.syncFromSystem();
    } else {
      this.detachSystemDarkListener();
    }
  }

  resetToDefaults(): void {
    this.detachSystemDarkListener();
    this.layoutConfig.set({ ...DEFAULT_CONFIG });
    this.applyPreset(DEFAULT_CONFIG.preset);
    this.applyBorderRadius(DEFAULT_CONFIG.borderRadius);
  }

  onMenuToggle(): void {
    const mode = this.layoutConfig().menuMode;

    if (this.isDesktop()) {
      if (mode === 'static') {
        // Desktop static: collapse to / expand from the icon-only rail.
        this.layoutConfig.update((config) => ({
          ...config,
          sidebarCollapsed: !config.sidebarCollapsed,
        }));
      } else {
        // overlay desktop: toggle the slide-in panel
        this.layoutState.update((state) => ({
          ...state,
          overlayMenuActive: !state.overlayMenuActive,
        }));
      }
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

  /** Used by external callers to ensure the mask click clears both overlays. */
  closeOverlays(): void {
    this.hideMenu();
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

    this.applyBorderRadius(this.layoutConfig().borderRadius);
  }

  private applyFontScale(scale: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.style.fontSize = `${scale}px`;
  }

  private applyRipple(value: boolean): void {
    this.primengConfig.ripple.set(value);
  }

  private applyInputVariant(variant: InputVariant): void {
    this.primengConfig.inputStyle.set(variant);
  }

  private applyBorderRadius(mode: BorderRadiusMode): void {
    const radii = BORDER_RADIUS_VALUES[mode];
    updatePreset({
      semantic: {
        borderRadius: radii,
      },
    });
  }

  private attachSystemDarkListener(): void {
    if (!isPlatformBrowser(this.platformId) || this.mediaQueryList) return;
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryHandler = (e: MediaQueryListEvent) => {
      this.layoutConfig.update((state) => ({ ...state, darkTheme: e.matches }));
    };
    this.mediaQueryList.addEventListener('change', this.mediaQueryHandler);
  }

  private detachSystemDarkListener(): void {
    if (this.mediaQueryList && this.mediaQueryHandler) {
      this.mediaQueryList.removeEventListener('change', this.mediaQueryHandler);
    }
    this.mediaQueryList = null;
    this.mediaQueryHandler = null;
  }

  private syncFromSystem(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.layoutConfig.update((state) => ({ ...state, darkTheme: prefersDark }));
  }

  private loadConfig(): LayoutConfig {
    const parsed = this.storage.getJSON<Partial<LayoutConfig>>(STORAGE_KEYS.LAYOUT_CONFIG);
    if (!parsed || parsed.version !== CONFIG_VERSION) {
      return { ...DEFAULT_CONFIG };
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  }

  private saveConfig(config: LayoutConfig): void {
    this.storage.setJSON(STORAGE_KEYS.LAYOUT_CONFIG, config);
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
