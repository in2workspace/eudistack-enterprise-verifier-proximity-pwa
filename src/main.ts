import { importProvidersFrom, isDevMode, APP_INITIALIZER } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { provideHttpClient, withInterceptorsFromDi, HttpClient } from '@angular/common/http';
import { NgxIndexedDBModule, DBConfig } from 'ngx-indexed-db';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { IonicStorageModule } from '@ionic/storage-angular';
import { DB_CONFIG } from './app/core/services/storage.service';
import { ThemeService } from './app/core/services/theme.service';

/**
 * TranslateHttpLoader factory
 * Loads translation files from assets/i18n/
 */
export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

// IndexedDB configuration
const dbConfig: DBConfig = {
  name: 'verifier_db',
  version: 1,
  objectStoresMeta: DB_CONFIG
};

/**
 * Initialize Theme on app startup
 * 
 * Loads theme configuration and applies CSS variables
 * Priority: URL param > env.js > default 'kpmg'
 */
function initializeTheme(themeService: ThemeService): () => Promise<void> {
  return () => {
    // Priority 1: URL parameter (e.g., ?tenant=altia)
    const urlParams = new URLSearchParams(window.location.search);
    let tenantId = urlParams.get('tenant');
    
    // Priority 2: env.js configuration
    if (!tenantId && (window as any).env?.tenant) {
      tenantId = (window as any).env.tenant;
      console.log('[Theme] Using tenant from env.js:', tenantId);
    }
    
    // Priority 3: Default to Altia
    if (!tenantId) {
      tenantId = 'altia';
    }
    
    console.log('[Theme] Loading theme for tenant:', tenantId);
    
    return themeService.loadTheme(tenantId).catch(error => {
      console.error('Failed to initialize theme:', error);
      // Don't block app startup on theme failure (hardcoded fallback will be used)
      return Promise.resolve();
    });
  };
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(
      IonicModule.forRoot({ innerHTMLTemplatesEnabled: true })
    ),    
    importProvidersFrom(IonicStorageModule.forRoot()),
    importProvidersFrom(NgxIndexedDBModule.forRoot(dbConfig)),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient]
        }
      })
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTheme,
      deps: [ThemeService],
      multi: true
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
