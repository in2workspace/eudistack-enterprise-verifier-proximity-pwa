import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, timer, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { VerificationSession, SessionStatus } from '../models/verification-session.model';
import { CryptoService } from './crypto.service';

/**
 * Session State Service
 * 
 * Manages ephemeral verification sessions with automatic timeout.
 * Uses RxJS BehaviorSubjects for reactive state management.
 * 
 * Session lifecycle:
 * 1. createSession() - Generate keypair, nonce, create JWT authorization request
 * 2. ACTIVE - Wait for VP submission (120s timeout)
 * 3. VALIDATING - VP received, validation in progress
 * 4. COMPLETED/FAILED - Validation result
 * 5. EXPIRED - Timeout reached, session regenerated
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class SessionStateService implements OnDestroy {
  // Dependencies
  private readonly cryptoService = inject(CryptoService);
  
  // Session timeout in seconds (default: 120s)
  private readonly SESSION_TIMEOUT_SECONDS = 120;

  // Current session state
  private sessionSubject$ = new BehaviorSubject<VerificationSession | null>(null);
  
  // Session expiration events
  private sessionExpiredSubject$ = new Subject<string>();

  // Timer cancellation
  private cancelTimer$ = new Subject<void>();

  /**
   * Create a new verification session
   * 
   * Generates:
   * - Unique session ID
   * - Ephemeral keypair (ES256)
   * - Random nonce
   * - JWT authorization request (JAR)
   * 
   * Starts automatic timeout timer.
   * 
   * @param options Session creation options
   * @returns Created session
   */
  public async createSession(
    options: CreateSessionOptions = {}
  ): Promise<VerificationSession> {
    try {
      // Cancel existing timer
      this.cancelTimer$.next();

      // Generate session ID
      const sessionId = uuidv4();

      // Use provided keypair or generate new one
      // IMPORTANT: When using did:key as client_id, the keypair MUST be the same
      // one used to derive the DID. Otherwise signature verification will fail.
      const algorithm = options.algorithm ?? 'ES256';
      const keypair = options.keypair ?? await this.cryptoService.generateKeyPair(algorithm);

      // Generate random nonce
      const nonce = this.cryptoService.generateNonce();

      // Get timeout duration
      const timeoutSeconds = options.timeoutSeconds ?? this.SESSION_TIMEOUT_SECONDS;

      // Create timestamps
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(
        Date.now() + timeoutSeconds * 1000
      ).toISOString();

      // Build authorization request payload
      const clientId = options.clientId ?? 'kpmg-verifier';
      
      // Response URI for same-device proximity flow
      // PWA registers custom protocol handler in manifest.json
      const responseUri = options.responseUri ?? window.location.origin + '/verify/response';
      
      const requestPayload = {
        // Per OID4VP spec, iss (issuer) must equal client_id
        iss: clientId,
        aud: 'https://self-issued.me/v2',
        response_type: 'vp_token',
        response_mode: 'direct_post',
        response_uri: responseUri,
        client_id: clientId,
        client_metadata: {
          vp_formats_supported: {
            jwt_vp_json: {
              alg_values_supported: ['ES256', 'EdDSA']
            }
          }
        },
        nonce: nonce,
        state: this.cryptoService.generateState(),
        jti: uuidv4(), // JWT ID for uniqueness
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + timeoutSeconds
      };

      // Sign authorization request (JAR)
      // Per OID4VP spec, typ must be 'oauth-authz-req+jwt' for authorization requests
      // kid must be the DID (client_id) for wallet to resolve public key
      const requestObject = await this.cryptoService.signJwt(
        requestPayload,
        keypair.privateKey,
        algorithm,
        'oauth-authz-req+jwt',
        clientId  // kid = DID
      );

      // Create session object
      const session: VerificationSession = {
        sessionId,
        clientId,
        keypair,
        nonce,
        requestObject,
        createdAt,
        expiresAt,
        status: SessionStatus.ACTIVE
      };

      // Update state
      this.sessionSubject$.next(session);

      // Start timeout timer
      this.startSessionTimer(sessionId, timeoutSeconds);

      return session;
    } catch (error) {
      throw new SessionError('Failed to create session', error);
    }
  }

  /**
   * Get current session as Observable
   * 
   * @returns Observable of current session (null if no active session)
   */
  public getSession(): Observable<VerificationSession | null> {
    return this.sessionSubject$.asObservable();
  }

  /**
   * Get current session value (synchronous)
   * 
   * @returns Current session or null
   */
  public getCurrentSession(): VerificationSession | null {
    return this.sessionSubject$.value;
  }

  /**
   * Update session status
   * 
   * @param status New session status
   */
  public updateSessionStatus(status: SessionStatus): void {
    const currentSession = this.sessionSubject$.value;
    
    if (!currentSession) {
      console.warn('Cannot update status: no active session');
      return;
    }

    this.sessionSubject$.next({
      ...currentSession,
      status
    });
  }

  /**
   * Mark session as validating
   */
  public setValidating(): void {
    this.updateSessionStatus(SessionStatus.VALIDATING);
  }

  /**
   * Mark session as completed
   */
  public setCompleted(): void {
    this.updateSessionStatus(SessionStatus.COMPLETED);
    this.cancelTimer$.next(); // Stop timeout timer
  }

  /**
   * Mark session as failed
   */
  public setFailed(): void {
    this.updateSessionStatus(SessionStatus.FAILED);
    this.cancelTimer$.next(); // Stop timeout timer
  }

  /**
   * Listen to session expiration events
   * 
   * @returns Observable of expired session IDs
   */
  public onSessionExpired(): Observable<string> {
    return this.sessionExpiredSubject$.asObservable();
  }

  /**
   * Clear current session
   * 
   * Clears keypair from memory (garbage collection).
   * Cancels active timers.
   */
  public clearSession(): void {
    this.cancelTimer$.next();
    this.sessionSubject$.next(null);
  }

  /**
   * Regenerate session after expiration
   * 
   * Auto-called when timeout occurs.
   * Can be manually triggered.
   * 
   * @returns New session
   */
  public async regenerateSession(): Promise<VerificationSession> {
    this.clearSession();
    return this.createSession();
  }

  /**
   * Check if session is expired
   * 
   * @param session Session to check
   * @returns True if expired
   */
  public isSessionExpired(session: VerificationSession): boolean {
    const now = new Date().getTime();
    const expiresAt = new Date(session.expiresAt).getTime();
    return now >= expiresAt;
  }

  /**
   * Get remaining time in seconds
   * 
   * @param session Session to check
   * @returns Remaining seconds (0 if expired)
   */
  public getRemainingTime(session: VerificationSession): number {
    const now = new Date().getTime();
    const expiresAt = new Date(session.expiresAt).getTime();
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    return remaining;
  }

  /**
   * Get session timeout duration
   * 
   * @returns Timeout in seconds
   */
  public getSessionTimeout(): number {
    return this.SESSION_TIMEOUT_SECONDS;
  }

  /**
   * Destroy service (cleanup)
   */
  public ngOnDestroy(): void {
    this.cancelTimer$.next();
    this.cancelTimer$.complete();
    this.sessionSubject$.complete();
    this.sessionExpiredSubject$.complete();
  }

  /**
   * Start session timeout timer
   * 
   * @param sessionId Session ID to monitor
   * @param timeoutSeconds Timeout duration in seconds
   */
  private startSessionTimer(sessionId: string, timeoutSeconds: number): void {
    const timeoutMs = timeoutSeconds * 1000;

    timer(timeoutMs)
      .pipe(takeUntil(this.cancelTimer$))
      .subscribe(() => {
        const currentSession = this.sessionSubject$.value;

        if (currentSession && currentSession.sessionId === sessionId) {
          // Mark as expired
          this.sessionSubject$.next({
            ...currentSession,
            status: SessionStatus.EXPIRED
          });

          // Emit expiration event
          this.sessionExpiredSubject$.next(sessionId);

          console.log(`Session ${sessionId} expired after ${timeoutSeconds}s`);
        }
      });
  }
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /**
   * Client ID for authorization request (verifier DID:key)
   * Should be dynamically generated using VerifierIdentityService
   */
  clientId?: string;

  /**
   * Keypair for signing the authorization request
   * MUST be the same keypair used to generate the clientId (DID)
   * If not provided, a new keypair will be generated
   */
  keypair?: CryptoKeyPair;

  /**
   * Response URI where wallet will POST the VP token
   * Default: window.location.origin + '/verify/response'
   * For same-device flow, can use custom protocol handler
   */
  responseUri?: string;

  /**
   * Signing algorithm
   * Default: 'ES256'
   */
  algorithm?: 'ES256' | 'EdDSA';

  /**
   * Custom timeout in seconds
   * Default: 120
   */
  timeoutSeconds?: number;
}

/**
 * Session error class
 */
export class SessionError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SessionError';
  }
}
