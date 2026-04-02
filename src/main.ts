import { importProvidersFrom, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgxIndexedDBModule, DBConfig } from 'ngx-indexed-db';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { IonicStorageModule } from '@ionic/storage-angular';
import { DB_CONFIG } from './app/core/services/storage.service';

// IndexedDB configuration
const dbConfig: DBConfig = {
  name: 'verifier_db',
  version: 1,
  objectStoresMeta: DB_CONFIG
};

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes),
    importProvidersFrom(
      IonicModule.forRoot({ innerHTMLTemplatesEnabled: true })
    ),    
    importProvidersFrom(IonicStorageModule.forRoot()),
    importProvidersFrom(NgxIndexedDBModule.forRoot(dbConfig)),
    provideHttpClient(withInterceptorsFromDi()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
