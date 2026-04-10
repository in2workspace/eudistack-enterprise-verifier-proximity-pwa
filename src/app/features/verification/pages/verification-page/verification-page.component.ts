import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';

// Services (FASE 1 - API Integration)
import { VerificationFlowService, VerificationState } from '../../../../core/services/verification-flow.service';
import { QrData } from '../../../../core/services/qr-generation.service';

// Components
import { QRDisplayComponent } from '../../components/qr-display/qr-display.component';
import { ValidationPopupComponent } from '../../components/validation-popup/validation-popup.component';
import { WelcomeMessageComponent } from '../../components/welcome-message/welcome-message.component';

/**
 * Verification Page Component
 * 
 * **OAuth2 Client Flow (same as MFE Login)**
 * 
 * Acts as OAuth2 client of eudistack-core-verifier:
 * 1. Redirects to /oidc/authorize (if no authRequest in URL)
 * 2. Backend redirects back with authRequest + state + homeUri
 * 3. Display QR and wait for wallet scan
 * 4. Listen to SSE events for verification completion
 * 5. Show result (success/error)
 * 
 * **OAuth2 Flow:**
 * - GET /oidc/authorize?client_id=proximity-verifier-pwa&redirect_uri=.../login&scope=openid learcredential.employee&state=...
 * - Backend → Redirect to /login?authRequest=openid4vp://...&state=...&homeUri=...
 * - Display QR → Wallet scans → POST /oid4vp/auth-response (to backend)
 * - SSE: GET /api/login/events?state={state} → 'redirect' event
 * 
 * @component
 */
@Component({
  selector: 'app-verification-page',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    QRDisplayComponent,
    ValidationPopupComponent,
    WelcomeMessageComponent
  ],
  templateUrl: './verification-page.component.html',
  styleUrls: ['./verification-page.component.scss']
})
export class VerificationPageComponent implements OnInit, OnDestroy {
  // ── Dependencies ──
  private readonly verificationFlow = inject(VerificationFlowService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ── State (reactive signals) ──
  readonly currentState = signal<VerificationState['status']>('waiting');
  readonly qrData = signal<QrData | null>(null);
  readonly userData = signal<any>(null);
  readonly errorMessage = signal<string>('');
  readonly errorCode = signal<string>('');

  // ── Computed ──
  readonly qrCodeUrl = computed(() => {
    const qr = this.qrData();
    if (!qr) return '';
    
    // The backend returns the full authorization request JWT
    // We display it directly in the QR code
    return qr.uri;
  });

  readonly isWaiting = computed(() => this.currentState() === 'waiting');
  readonly isValidating = computed(() => this.currentState() === 'validating');
  readonly isSuccess = computed(() => this.currentState() === 'success');
  readonly isError = computed(() => this.currentState() === 'error');

  readonly userName = computed(() => {
    const user = this.userData();
    return user?.name || 'Usuario';
  });

  // ── Lifecycle ──
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Check if we have authRequest from URL params (OAuth2 redirect from backend)
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      const authRequest = params['authRequest'];
      const state = params['state'];
      const homeUri = params['homeUri'];

      if (authRequest && state) {
        // Backend redirected with authRequest → start cross-device flow
        console.log('[VerificationPage] OAuth2 redirect received:', { state, homeUri });
        this.startCrossDeviceFlow(authRequest, state);
      } else {
        // No authRequest → initiate OAuth2 authorization request
        console.log('[VerificationPage] No authRequest - redirecting to /oauth2/authorize');
        this.initiateOAuth2Flow();
      }
    });
  }

  ngOnDestroy(): void {
    this.verificationFlow.cancelVerification();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initiate OAuth2 authorization flow
   * 
   * Redirects to backend /oidc/authorize endpoint to start the flow.
   * Backend will redirect back to this PWA with authRequest + state.
   */
  private initiateOAuth2Flow(): void {
    const backendUrl = this.getBackendUrl();
    const redirectUri = window.location.origin + '/login';  // Always redirect to /login
    const state = this.generateState();
    
    // OAuth2 client_id (must be registered in backend verifier)
    const clientId = 'proximity-verifier-pwa';
    const scope = 'learcredential';
    
    // Build OAuth2 authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      state: state
    });
    
    const authUrl = `${backendUrl}/oidc/authorize?${params.toString()}`;
    
    console.log('[VerificationPage] Redirecting to OAuth2 authorization:', {
      backendUrl,
      redirectUri,
      state,
      authUrl
    });
    
    // Redirect to backend
    window.location.href = authUrl;
  }

  /**
   * Get backend URL from configuration
   */
  private getBackendUrl(): string {
    const runtimeUrl = (window as any)['env']?.['verifierBackendUrl'];
    if (runtimeUrl) {
      return runtimeUrl;
    }
    
    // Fallback for development
    return 'http://localhost:8082';
  }

  /**
   * Generate OAuth2 state parameter (UUID)
   */
  private generateState(): string {
    return crypto.randomUUID();
  }

  /**
   * Start cross-device verification flow
   * 
   * Used when PWA is invoked from backend redirect with authRequest URL.
   */
  private startCrossDeviceFlow(authRequest: string, state: string): void {
    console.log('[VerificationPage] Starting cross-device flow');
    
    this.verificationFlow.startFromAuthRequest(authRequest, state).pipe(
      tap(state => {
        console.log('[VerificationPage] State change:', state);
        this.handleStateChange(state);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      error: (error) => {
        console.error('[VerificationPage] Flow error:', error);
        this.showError('FLOW_ERROR', 'Error al iniciar verificación');
      },
      complete: () => {
        console.log('[VerificationPage] Flow completed');
      }
    });
  }

  /**
   * Handle verification state changes
   */
  private handleStateChange(state: VerificationState): void {
    switch (state.status) {
      case 'waiting':
        this.currentState.set('waiting');
        this.qrData.set(state.qrData);
        break;

      case 'validating':
        this.currentState.set('validating');
        break;

      case 'success':
        this.currentState.set('success');
        this.userData.set(state.userData);
        break;

      case 'error':
        this.showError(
          state.error.code,
          state.error.message
        );
        break;
    }
  }

  /**
   * Show error state
   */
  private showError(code: string, message: string): void {
    this.currentState.set('error');
    this.errorCode.set(code);
    this.errorMessage.set(message);
  }

  /**
   * Handle QR regeneration
   * 
   * Called when user clicks "Regenerate QR" button.
   */
  onQrRegenerate(): void {
    console.log('[VerificationPage] Regenerating QR');
    this.verificationFlow.regenerateQr().pipe(
      tap(state => this.handleStateChange(state)),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  /**
   * Handle retry after error
   * 
   * Restarts the OAuth2 flow.
   */
  onRetry(): void {
    console.log('[VerificationPage] Retrying verification - redirecting to OAuth2');
    this.initiateOAuth2Flow();
  }

  /**
   * Navigate back to home
   */
  onGoHome(): void {
    this.router.navigate(['/']);
  }
}
