import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'verification',
    pathMatch: 'full'
  },
  {
    path: 'verification',
    loadComponent: () => import('./features/verification/pages/verification-page/verification-page.component')
      .then(m => m.VerificationPageComponent)
  }
];
