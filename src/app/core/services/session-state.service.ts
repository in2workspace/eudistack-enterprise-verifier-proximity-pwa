import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, timer, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { VerificationSession, SessionStatus } from '../models/verification-session.model';

/**
 * Session State Service
 * 
 * Manages ephemeral verification sessions with automatic timeout.
 * Uses RxJS BehaviorSubjects for reactive state management.
 * 
 * **TODO (FASE 1 - API Integration):**
 * - Remove CryptoService dependency (eliminated - backend generates auth requests)
 * - Simplify createSession() to only track sessionId and state
 * - Backend provides authorization request JWT via API
 * - Remove keypair generation and JWT signing logic
 * 
 * Session lifecycle (NEW):
 * 1. createSession() - Generate sessionId, call backend for auth request JWT
 * 2. ACTIVE - Wait for VP submission (120s timeout)
 * 3. VALIDATING - VP received (backend validates)
 * 4. COMPLETED/FAILED - Validation result from backend (via SSE)
 * 5. EXPIRED - Timeout reached, session regenerated
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class SessionStateService implements OnDestroy {
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
   * **TODO (FASE 1 - API Integration):**
   * This method needs to be reimplemented to use the backend API instead of local crypto.
   * 
   * New implementation should:
   * 1. Generate sessionId (UUID)
   * 2. Call VerifierApiService.getAuthRequest(sessionId) → get JWT from backend
   * 3. Store sessionId and JWT in session state
   * 4. Start SSE listener for this sessionId
   * 5. Start timeout timer
   * 
   * @param options Session creation options (currently unused)
   * @returns Created session
   */
  public async createSession(
    options: CreateSessionOptions = {}
  ): Promise<VerificationSession> {
    throw new Error(
      'SessionStateService.createSession() is deprecated. ' +
      'It depended on CryptoService (removed). ' +
      'Needs reimplementation in FASE 1 to consume backend API. ' +
      'See ROADMAP.md section "Integración con Backend".'
    );
    
    /*
    // OLD IMPLEMENTATION (REMOVED - depended on CryptoService)
    try {
      // Cancel existing timer
      this.cancelTimer$.next();

      // Generate session ID
      const sessionId = uuidv4();

      // Generate keypair (backend now does this)
      const algorithm = options.algorithm ?? 'ES256';
      const keypair = options.keypair ?? await this.cryptoService.generateKeyPair(algorithm);

      // Generate nonce (backend now does this)
      const nonce = this.cryptoService.generateNonce();

      // ... rest of implementation removed ...

      return session;
    } catch (error) {
      throw new SessionError('Failed to create session', error);
    }
    */
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
