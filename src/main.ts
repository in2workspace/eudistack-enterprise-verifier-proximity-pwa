import { importProvidersFrom, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppComponent } from './app/app.component';
import { IonicStorageModule } from '@ionic/storage-angular';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    importProvidersFrom(
      IonicModule.forRoot({ innerHTMLTemplatesEnabled: true })
    ),    
    importProvidersFrom(IonicStorageModule.forRoot()),    
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
