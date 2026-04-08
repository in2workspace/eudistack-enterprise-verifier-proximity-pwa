import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/verification/pages/verification-page/verification-page.component')
      .then(m => m.VerificationPageComponent)
  },
  {
    path: 'verification',
    loadComponent: () => import('./features/verification/pages/verification-page/verification-page.component')
      .then(m => m.VerificationPageComponent)
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];
