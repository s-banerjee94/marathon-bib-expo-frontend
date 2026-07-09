import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideRouter,
  withComponentInputBinding,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { LayoutService } from './core/services/layout.service';
import { PwaUpdateService } from './core/services/pwa-update.service';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { offlineInterceptor } from './core/interceptors/offline-interceptor';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from '../environments/environment';

const NoirAura = definePreset(Aura, {
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
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          // Tag the route transition so CSS keeps the page swap instant and only
          // animates the active-nav indicator (see styles.css). The dark-mode
          // toggle runs its own startViewTransition without this marker.
          const root = inject(DOCUMENT).documentElement;
          root.classList.add('route-transition');
          transition.finished
            .finally(() => root.classList.remove('route-transition'))
            // Rapid navigations abort the previous transition; `finished` then
            // rejects and would otherwise surface as an unhandled-promise error.
            .catch(() => {});
        },
      }),
    ),
    provideHttpClient(withInterceptors([offlineInterceptor, authInterceptor, errorInterceptor])),
    AuthService,
    MessageService,
    ConfirmationService,
    DialogService,
    providePrimeNG({
      ripple: true,
      theme: {
        preset: NoirAura,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng, utilities',
          },
        },
      },
    }),
    provideAppInitializer(() => {
      inject(LayoutService).initializeTheme();
      inject(PwaUpdateService).init();
      return inject(AuthService).bootstrap();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
