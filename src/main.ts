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
import { TrustFrameworkService } from './app/core/services/trust-framework.service';

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
 * Initialize Trust Framework on app startup
 * 
 * Loads trusted issuers from JSON and syncs to IndexedDB
 */
function initializeTrustFramework(trustFramework: TrustFrameworkService): () => Promise<void> {
  return () => trustFramework.loadTrustFramework().catch(error => {
    console.error('Failed to initialize trust framework:', error);
    // Don't block app startup on trust framework failure
    return Promise.resolve();
  });
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
      useFactory: initializeTrustFramework,
      deps: [TrustFrameworkService],
      multi: true
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
