import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Services
import { SessionStateService } from '../../../../core/services/session-state.service';
import { ValidationService } from '../../../../core/services/validation.service';
import { StorageService } from '../../../../core/services/storage.service';
import { VerifierIdentityService } from '../../../../core/services/verifier-identity.service';

// Components
import { QRDisplayComponent } from '../../components/qr-display/qr-display.component';
import { ValidationPopupComponent } from '../../components/validation-popup/validation-popup.component';
import { WelcomeMessageComponent } from '../../components/welcome-message/welcome-message.component';

// Models
import { VerificationSession, SessionStatus } from '../../../../core/models/verification-session.model';
import { ValidatedPresentation } from '../../../../core/models/validated-presentation.model';

/**
 * Verification Page States
 */
enum PageState {
  /** Initializing session */
  INITIALIZING = 'initializing',
  
  /** Waiting for wallet scan (showing QR) */
  WAITING_FOR_SCAN = 'waiting-for-scan',
  
  /** Validation in progress */
  VALIDATING = 'validating',
  
  /** Success - show welcome message */
  SUCCESS = 'success',
  
  /** Error - show error message */
  ERROR = 'error'
}

/**
 * Verification Page Component
 * 
 * Main page that orchestrates the complete verification flow:
 * 1. Initialize session → Generate QR
 * 2. Wait for VP submission from wallet
 * 3. Validate VP/VC
 * 4. Show result (success/error)
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
  private readonly sessionService = inject(SessionStateService);
  private readonly validationService = inject(ValidationService);
  private readonly storageService = inject(StorageService);
  private readonly verifierIdentity = inject(VerifierIdentityService);
  private readonly router = inject(Router);

  // ── State ──
  readonly currentState = signal<PageState>(PageState.INITIALIZING);
  readonly currentSession = signal<VerificationSession | null>(null);
  readonly validationResult = signal<ValidatedPresentation | null>(null);
  readonly errorMessage = signal<string>('');
  readonly errorDetails = signal<string>('');

  // ── Computed ──
  readonly qrCodeUrl = computed(() => {
    const session = this.currentSession();
    if (!session) return '';
    
    // OID4VP authorization request with JAR by Value
    // Since this is a PWA without backend, we include the JWT directly in the QR
    // Per OID4VP spec: request parameter contains the signed JWT
    const clientId = session.clientId;
    const request = session.requestObject;
    
    return `openid4vp://?client_id=${encodeURIComponent(clientId)}&request=${encodeURIComponent(request)}`;
  });

  readonly isInitializing = computed(() => this.currentState() === PageState.INITIALIZING);
  readonly isWaitingForScan = computed(() => this.currentState() === PageState.WAITING_FOR_SCAN);
  readonly isValidating = computed(() => this.currentState() === PageState.VALIDATING);
  readonly isSuccess = computed(() => this.currentState() === PageState.SUCCESS);
  readonly isError = computed(() => this.currentState() === PageState.ERROR);

  readonly validationChecks = computed(() => {
    const result = this.validationResult();
    if (!result) return [false, false, false, false];

    const vr = result.validationResult;
    return [
      vr.vpValid,
      vr.vcSignatureValid,
      vr.trustValid,
      vr.statusValid
    ];
  });

  readonly userFirstName = computed(() => {
    const result = this.validationResult();
    if (!result || result.verifiableCredentials.length === 0) return '';
    
    const vc = result.verifiableCredentials[0];
    const subject = vc.vc.credentialSubject;
    return (subject as any).first_name || (subject as any).given_name || '';
  });

  readonly userFamilyName = computed(() => {
    const result = this.validationResult();
    if (!result || result.verifiableCredentials.length === 0) return '';
    
    const vc = result.verifiableCredentials[0];
    const subject = vc.vc.credentialSubject;
    return (subject as any).family_name || (subject as any).last_name || '';
  });

  // ── Lifecycle ──
  private destroy$ = new Subject<void>();

  // ── Expose enum to template ──
  readonly PageState = PageState;

  ngOnInit(): void {
    this.initializeSession();
    this.listenToDirectPost();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize verification session
   */
  private async initializeSession(): Promise<void> {
    try {
      this.currentState.set(PageState.INITIALIZING);

      // Get verifier's identity (DID + keypair)
      const identity = await this.verifierIdentity.getIdentity();

      // Create new session with the same keypair used for the DID
      // This ensures the JWT signature can be verified with the public key from the DID
      const session = await this.sessionService.createSession({
        clientId: identity.clientId,
        keypair: identity.keypair,
        timeoutSeconds: 120
      });

      this.currentSession.set(session);
      this.currentState.set(PageState.WAITING_FOR_SCAN);

      // Listen for session expiration
      this.sessionService.getSession()
        .pipe(takeUntil(this.destroy$))
        .subscribe(updatedSession => {
          if (updatedSession?.status === SessionStatus.EXPIRED) {
            this.onSessionExpired();
          }
        });

    } catch (error) {
      console.error('[VerificationPage] Failed to initialize session:', error);
      this.showError('Failed to initialize session', String(error));
    }
  }

  /**
   * Listen to direct_post submissions from wallet
   * 
   * In production, this would be handled by Service Worker intercepting POST /direct_post
   * For now, we simulate it with BroadcastChannel or polling
   */
  private listenToDirectPost(): void {
    // Listen for VP submission via BroadcastChannel
    const channel = new BroadcastChannel('direct_post');
    
    channel.onmessage = async (event) => {
      const { vp_token, presentation_submission, state } = event.data;
      
      if (vp_token) {
        await this.handleVpSubmission(vp_token);
      }
    };

    // Cleanup on destroy
    this.destroy$.subscribe(() => {
      channel.close();
    });
  }

  /**
   * Handle VP submission from wallet
   */
  private async handleVpSubmission(vpToken: string): Promise<void> {
    try {
      const session = this.currentSession();
      if (!session) {
        throw new Error('No active session');
      }

      this.currentState.set(PageState.VALIDATING);

      // Update session status
      this.sessionService.setValidating();

      // Validate presentation
      const result = await firstValueFrom(
        this.validationService.validatePresentation(
          session.sessionId,
          vpToken,
          session.nonce,
          session.keypair.publicKey
        )
      );

      this.validationResult.set(result);

      // Check if validation passed
      const vr = result.validationResult;
      const isValid = vr.vpValid && 
                      vr.vcSignatureValid && 
                      vr.trustValid && 
                      vr.statusValid &&
                      vr.errors.length === 0;

      if (isValid) {
        // Success!
        this.sessionService.setCompleted();

        // Log successful validation
        await this.logVerification(session.sessionId, result, true);

        this.currentState.set(PageState.SUCCESS);
      } else {
        // Validation failed
        this.sessionService.setFailed();

        // Log failed validation
        await this.logVerification(session.sessionId, result, false);

        const errorMsg = vr.errors.map(e => e.message).join('; ');
        this.showError('Validation failed', errorMsg);
      }

    } catch (error) {
      console.error('[VerificationPage] Validation error:', error);
      this.showError('Validation error', String(error));
    }
  }

  /**
   * Log verification attempt
   */
  private async logVerification(
    sessionId: string,
    result: ValidatedPresentation,
    success: boolean
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.storageService.saveValidationLog(result)
      );
    } catch (error) {
      console.error('[VerificationPage] Failed to log verification:', error);
      // Don't block flow on logging error
    }
  }

  /**
   * Handle QR expiration
   */
  onQrExpired(): void {
    console.log('[VerificationPage] QR expired, regenerating...');
    this.initializeSession();
  }

  /**
   * Handle QR regeneration request
   */
  onQrRegenerate(): void {
    console.log('[VerificationPage] QR regeneration requested');
    this.initializeSession();
  }

  /**
   * Handle session expiration
   */
  private onSessionExpired(): void {
    console.log('[VerificationPage] Session expired');
    
    // Auto-regenerate
    this.initializeSession();
  }

  /**
   * Handle validation retry
   */
  onValidationRetry(): void {
    console.log('[VerificationPage] Validation retry requested');
    this.initializeSession();
  }

  /**
   * Handle welcome continue
   */
  onWelcomeContinue(): void {
    console.log('[VerificationPage] Welcome continue clicked');
    
    // Reset to waiting state
    this.initializeSession();
  }

  /**
   * Handle welcome countdown complete
   */
  onWelcomeCountdownComplete(): void {
    console.log('[VerificationPage] Welcome countdown complete');
    
    // Auto-restart
    this.initializeSession();
  }

  /**
   * Show error state
   */
  private showError(message: string, details: string): void {
    this.errorMessage.set(message);
    this.errorDetails.set(details);
    this.currentState.set(PageState.ERROR);
  }

  /**
   * Handle error retry
   */
  onErrorRetry(): void {
    console.log('[VerificationPage] Error retry requested');
    this.initializeSession();
  }
}
