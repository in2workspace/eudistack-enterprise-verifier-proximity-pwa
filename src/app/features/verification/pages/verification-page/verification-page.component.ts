import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { tap, takeUntil } from 'rxjs/operators';

import { VerificationFlowService, VerificationState } from '../../../../core/services/verification-flow.service';
import { QrData } from '../../../../core/services/qr-generation.service';

// Components
import { QRDisplayComponent } from '../../components/qr-display/qr-display.component';
import { ValidationPopupComponent } from '../../components/validation-popup/validation-popup.component';
import { ValidationProgressComponent } from '../../components/validation-progress/validation-progress.component';
import { WelcomeMessageComponent } from '../../components/welcome-message/welcome-message.component';
import { CredentialRevokedComponent } from '../../components/credential-revoked/credential-revoked.component';

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
    ValidationProgressComponent,
    WelcomeMessageComponent,
    CredentialRevokedComponent
  ],
  templateUrl: './verification-page.component.html',
  styleUrls: ['./verification-page.component.scss']
})
export class VerificationPageComponent implements OnInit, OnDestroy {
  // ── State (reactive signals) ──
  public readonly currentState = signal<VerificationState['status'] | 'revoked'>('waiting');
  public readonly qrData = signal<QrData | null>(null);
  public readonly userData = signal<Record<string, unknown>>({});
  public readonly validationResults = signal<boolean[]>([true, true, true, true]);
  public readonly errorMessage = signal<string>('');
  public readonly errorCode = signal<string>('');
  // Pending success data (received during progress state)
  private readonly pendingSuccessData = signal<Record<string, unknown> | null>(null);
  // Control progress modal visibility independently from state
public readonly progressModalOpen = signal<boolean>(false);
  // Control revoked modal visibility
  public readonly revokedModalOpen = signal<boolean>(false);
  // ── Computed ──
  public readonly qrCodeUrl = computed(() => {
    const qr = this.qrData();
    if (!qr) return '';
    
    // The backend returns the full authorization request JWT
    // We display it directly in the QR code
    return qr.uri;
  });

  public readonly isWaiting = computed(() => this.currentState() === 'waiting');
  public readonly isValidating = computed(() => this.currentState() === 'validating');
  public readonly isProgress = computed(() => this.currentState() === 'progress');
  public readonly isSuccess = computed(() => this.currentState() === 'success');
  public readonly isError = computed(() => this.currentState() === 'error');
  public readonly isRevoked = computed(() => this.currentState() === 'revoked');

  public readonly userName = computed(() => {
    const user = this.userData();
    return (user['name'] as string) || (user['given_name'] as string) || 'Usuario';
  });

  public readonly userFirstName = computed(() => {
    const user = this.userData();
    return (user['given_name'] as string) || '';
  });

  public readonly userFamilyName = computed(() => {
    const user = this.userData();
    return (user['family_name'] as string) || '';
  });

  // ── Dependencies ──
  private readonly verificationFlow = inject(VerificationFlowService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ── Lifecycle ──
  private destroy$ = new Subject<void>();

  public ngOnInit(): void {
    // Check if we have authRequest from URL params (OAuth2 redirect from backend)
    // Use snapshot as params are read once and won't change during component lifecycle
    const params = this.route.snapshot.queryParams;
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
  }

  public ngOnDestroy(): void {
    this.verificationFlow.cancelVerification();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle QR regeneration
   * 
   * Called when user clicks "Regenerate QR" button.
   * Restarts the OAuth2 flow to get a new authRequest from the backend.
   */
  public onQrRegenerate(): void {
    console.log('[VerificationPage] Regenerating QR - restarting OAuth2 flow');
    this.verificationFlow.cancelVerification();
    this.initiateOAuth2Flow();
  }

  /**
   * Handle QR copied
   * 
   * Called when user copies QR code.
   * Shows validating state immediately (frontend-only).
   */
  public onQrCopied(): void {
    console.log('[VerificationPage] QR copied - showing validating state');
    // Immediately show validating popup when QR is copied
    this.currentState.set('validating');
  }

  /**   * Handle Retry from progress modal
   * 
   * If credential was revoked, show revoked screen.
   * Otherwise restart the OAuth2 flow.
   */
  public onProgressRetry(): void {
    console.log('[VerificationPage] Retry clicked from progress modal');
    const results = this.validationResults();
    
    // Check if credential is revoked (validation failed at index 3 = notRevoked)
    if (!results[3]) {
      console.log('[VerificationPage] Credential revoked detected - showing revoked screen');
      // Close progress modal
      this.progressModalOpen.set(false);
      // Wait for modal close animation then show revoked screen
      setTimeout(() => {
        this.currentState.set('revoked');
        this.revokedModalOpen.set(true);
      }, 350);
    } else {
      // Other errors - restart flow
      this.onRetry();
    }
  }

  /**   * Handle retry after error
   * 
   * Restarts the OAuth2 flow.
   */
  public onRetry(): void {
    console.log('[VerificationPage] Retrying verification - redirecting to OAuth2');
    this.initiateOAuth2Flow();
  }

  /**
   * Handle validation progress completion
   * 
   * Called when user clicks OK after all validation checks complete.
   * Advances to success state with the data received from backend.
   */
  public onProgressComplete(): void {
    console.log('[VerificationPage] Progress complete - closing modal before transition');
    const successData = this.pendingSuccessData();
    if (successData) {
      // Set userData first
      this.userData.set(successData);
      this.pendingSuccessData.set(null);
      
      // CRITICAL: Close modal first (set isOpen = false)
      this.progressModalOpen.set(false);
      console.log('[VerificationPage] Modal closing...');
      
      // Wait for ion-modal close animation (300ms)
      setTimeout(() => {
        console.log('[VerificationPage] State transition to success');
        this.currentState.set('success');
      }, 350);
    } else {
      console.warn('[VerificationPage] No pending success data, retrying flow');
      this.onRetry();
    }
  }

  /**
   * Navigate back to home
   */
  public onGoHome(): void {
    this.router.navigate(['/']);
  }

  /**
   * Initiate OAuth2 authorization flow with PKCE
   * 
   * Redirects to backend /oidc/authorize endpoint to start the flow.
   * Backend will redirect back to this PWA with authRequest + state.
   * 
   * PKCE (Proof Key for Code Exchange):
   * 1. Generate random code_verifier
   * 2. Calculate code_challenge = BASE64URL(SHA256(code_verifier))
   * 3. Send code_challenge in authorization request
   * 4. Store code_verifier in sessionStorage
   * 5. Send code_verifier in token request
   */
  private async initiateOAuth2Flow(): Promise<void> {
    const backendUrl = this.getBackendUrl();
    const redirectUri = window.location.origin + '/login';  // Always redirect to /login
    const state = this.generateState();
    
    // OAuth2 client_id (must be registered in backend verifier)
    const clientId = 'proximity-verifier-pwa';
    const scope = 'learcredential';
    
    // PKCE: Generate code_verifier and code_challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    // Store code_verifier in sessionStorage for later use in token request
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('pkce_state', state);
    
    // Build OAuth2 authorization URL with PKCE parameters
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    const authUrl = `${backendUrl}/oidc/authorize?${params.toString()}`;
    
    console.log('[VerificationPage] Redirecting to OAuth2 authorization with PKCE:', {
      backendUrl,
      redirectUri,
      state,
      codeChallenge: codeChallenge.substring(0, 10) + '...',
      authUrl
    });
    
    // Redirect to backend
    window.location.href = authUrl;
  }

  /**
   * Get backend URL from configuration
   */
  private getBackendUrl(): string {
    const runtimeUrl = window.env?.verifierBackendUrl;
    
    // If URL is explicitly set and not empty, use it
    if (runtimeUrl && runtimeUrl !== '') {
      return runtimeUrl;
    }
    
    // If empty string or undefined, use same origin (nginx proxy)
    // This is the case when served via nginx with relative URLs
    if (runtimeUrl === '') {
      return window.location.origin;
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
   * Generate PKCE code_verifier
   * 
   * Random URL-safe string with at least 43 characters and max 128.
   * Uses cryptographically secure random values.
   * 
   * @returns code_verifier string
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32); // 32 bytes = 256 bits
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate PKCE code_challenge from code_verifier
   * 
   * code_challenge = BASE64URL(SHA256(code_verifier))
   * 
   * @param codeVerifier The code verifier string
   * @returns code_challenge string
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return this.base64UrlEncode(hashArray);
  }

  /**
   * Base64URL encode (without padding)
   * 
   * @param buffer Uint8Array to encode
   * @returns Base64URL encoded string
   */
  private base64UrlEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
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
    const current = this.currentState();
    
    switch (state.status) {
      case 'waiting':
        this.currentState.set('waiting');
        this.qrData.set(state.qrData);
        break;

      case 'validating':
        this.currentState.set('validating');
        break;

      case 'progress':
        console.log('[VerificationPage] Progress state received with user data');
        this.currentState.set('progress');
        this.progressModalOpen.set(true); // Open modal explicitly
        if (state.validationResults) {
          this.validationResults.set(state.validationResults);
        }
        // Save user data for when user clicks OK/Retry button
        if (state.userData) {
          this.pendingSuccessData.set(state.userData);
        }
        break;

      case 'success':
        // Direct success (if progress was skipped for any reason)
        console.log('[VerificationPage] Direct success state');
        this.currentState.set('success');
        this.userData.set(state.userData);
        break;

      case 'error':
        if (state.error.code === 'SSE_TIMEOUT') {
          this.initiateOAuth2Flow();
        } else {
          this.showError(state.error.code, state.error.message);
        }
        break;
    }
  }

  /**
   * Show error state
   */
  private showError(code: string, message: string): void {
    // Check if error is specifically a revoked credential
    if (code === 'CREDENTIAL_REVOKED') {
      console.log('[VerificationPage] Credential revoked error - showing revoked screen');
      this.currentState.set('revoked');
      this.revokedModalOpen.set(true);
      this.errorCode.set(code);
      this.errorMessage.set(message);
    } else {
      // Generic error
      this.currentState.set('error');
      this.errorCode.set(code);
      this.errorMessage.set(message);
    }
  }

  /**
   * Handle try again from revoked screen
   */
  public onTryAgainFromRevoked(): void {
    console.log('[VerificationPage] Trying again from revoked screen');
    this.revokedModalOpen.set(false);
    this.userData.set({});
    this.errorCode.set('');
    this.errorMessage.set('');
    // Wait for modal close then restart flow
    setTimeout(() => {
      this.onRetry();
    }, 300);
  }
}
