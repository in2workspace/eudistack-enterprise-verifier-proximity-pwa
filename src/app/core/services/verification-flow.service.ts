import { Injectable, inject } from '@angular/core';
import { Observable, Subject, merge, of } from 'rxjs';
import { switchMap, catchError, takeUntil, finalize } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { QrGenerationService, QrData } from './qr-generation.service';
import { SseListenerService, LoginEvent } from './sse-listener.service';

/**
 * Verification Flow Service
 * 
 * Orchestrates the complete OID4VP verification flow.
 * Coordinates QR generation, SSE listening, and state management.
 * 
 * **Flow:**
 * 1. Generate QR code (via QrGenerationService)
 * 2. Subscribe to SSE events (via SseListenerService)
 * 3. Wait for wallet to submit VP
 * 4. Receive verification result from backend
 * 5. Emit final state (success/error)
 * 
 * **States:**
 * - `waiting` - QR displayed, waiting for wallet scan
 * - `validating` - VP received, backend validating
 * - `success` - Validation successful
 * - `error` - Validation failed or timeout
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class VerificationFlowService {
  private readonly qrGeneration = inject(QrGenerationService);
  private readonly sseListener = inject(SseListenerService);
  private readonly translate = inject(TranslateService);
  
  // Cancellation subject
  private readonly cancel$ = new Subject<void>();

  /**
   * Start verification flow
   * 
   * Initiates the complete verification flow:
   * 1. Generates QR code
   * 2. Subscribes to SSE for verification events
   * 3. Emits state changes as they occur
   * 
   * @returns Observable<VerificationState> - Stream of state changes
   */
  public startVerification(): Observable<VerificationState> {
    console.log('[VerificationFlowService] Starting verification flow');
    
    return this.qrGeneration.generateQr().pipe(
      switchMap(qrData => {
        console.log('[VerificationFlowService] QR generated, starting SSE listener');
        
        // Emit initial "waiting" state
        const waitingState: VerificationState = {
          status: 'waiting',
          qrData
        };
        
        // Subscribe to SSE events
        const sseEvents$ = this.sseListener.stream(qrData.state).pipe(
          switchMap(event => this.processEvent(event)),
          catchError(error => {
            console.error('[VerificationFlowService] SSE error:', error);
            
            const errorState: VerificationState = {
              status: 'error',
              error: {
                code: error.code || 'SSE_ERROR',
                message: error.message || this.translate.instant('verification.error.flow.sseError')
              }
            };
            return of(errorState);
          })
        );
        
        // Merge waiting state with SSE events
        return merge(
          of(waitingState),
          sseEvents$
        );
      }),
      takeUntil(this.cancel$),
      catchError(error => {
        console.error('[VerificationFlowService] Flow error:', error);
        
        const errorState: VerificationState = {
          status: 'error',
          error: {
            code: error.code || 'FLOW_ERROR',
            message: error.message || this.translate.instant('verification.error.flow.flowError')
          }
        };
        return of(errorState);
      }),
      finalize(() => {
        console.log('[VerificationFlowService] Flow finalized');
      })
    );
  }

  /**
   * Cancel current verification
   * 
   * Stops the verification flow and cleans up resources.
   * Closes SSE connection and cancels pending operations.
   */
  public cancelVerification(): void {
    console.log('[VerificationFlowService] Cancelling verification');
    this.cancel$.next();
  }

  /**
   * Start verification from received authRequest (cross-device flow)
   * 
   * Used when PWA is invoked from backend redirect with authRequest URL.
   * 
   * @param authRequest - Full openid4vp:// URL from backend
   * @param state - OAuth2 state parameter for SSE connection
   * @returns Observable<VerificationState> - Stream of state changes
   */
  public startFromAuthRequest(authRequest: string, state: string): Observable<VerificationState> {
    console.log('[VerificationFlowService] Starting from authRequest:', { state });
    
    return this.qrGeneration.createFromAuthRequest(authRequest, state).pipe(
      switchMap(qrData => {
        console.log('[VerificationFlowService] QR created from authRequest, starting SSE listener');
        
        // Emit initial "waiting" state
        const waitingState: VerificationState = {
          status: 'waiting',
          qrData
        };
        
        // Subscribe to SSE events
        const sseEvents$ = this.sseListener.stream(qrData.state).pipe(
          switchMap(event => this.processEvent(event)),
          catchError(error => {
            console.error('[VerificationFlowService] SSE error:', error);
            
            const errorState: VerificationState = {
              status: 'error',
              error: {
                code: error.code || 'SSE_ERROR',
                message: error.message || this.translate.instant('verification.error.flow.sseError')
              }
            };
            return of(errorState);
          })
        );
        
        // Merge waiting state with SSE events
        return merge(
          of(waitingState),
          sseEvents$
        );
      }),
      takeUntil(this.cancel$),
      catchError(error => {
        console.error('[VerificationFlowService] Flow error:', error);
        
        const errorState: VerificationState = {
          status: 'error',
          error: {
            code: error.code || 'FLOW_ERROR',
            message: error.message || this.translate.instant('verification.error.flow.flowError')
          }
        };
        return of(errorState);
      }),
      finalize(() => {
        console.log('[VerificationFlowService] Flow finalized');
      })
    );
  }

  /**
   * Regenerate QR and restart flow
   * 
   * Cancels current verification and starts a new one.
   * 
   * @returns Observable<VerificationState>
   */
  public regenerateQr(): Observable<VerificationState> {
    console.log('[VerificationFlowService] Regenerating QR');
    this.cancelVerification();
    return this.startVerification();
  }

  /**
   * Process SSE event and emit state
   * 
   * Now handles 'validating' event from SSE (wallet activity detected)
   * and 'progress' event when backend is performing technical checks.
   * 
   * @param event SSE login event
   * @returns Observable of verification state
   */
  private processEvent(event: LoginEvent): Observable<VerificationState> {
    console.log('[VerificationFlowService] Processing SSE event:', event.type);
    
    if (event.type === 'validating') {
      // Wallet has started communicating with backend
      return of({ status: 'validating' });
    } else if (event.type === 'progress') {
      // Backend is performing technical validation checks
      // Include userData if present (will be used when user clicks OK)
      return of({ 
        status: 'progress',
        validationResults: event.validationResults || [true, true, true, true],
        userData: event.userData
      });
    } else if (event.type === 'success') {
      return of({
        status: 'success',
        userData: event.userData || {},
        redirectUrl: event.redirectUrl
      });
    } else {
      return of({
        status: 'error',
        error: {
          code: event.errorCode || 'VERIFICATION_FAILED',
          message: event.error || this.translate.instant('verification.error.flow.verificationError')
        }
      });
    }
  }
}

/**
 * Verification State
 * 
 * Union type representing all possible states in the verification flow.
 * 
 * States:
 * - waiting: QR displayed, waiting for wallet scan
 * - validating: Wallet detected, waiting for credentials
 * - progress: VP received, backend validating (technical checks) - includes userData for later use
 * - success: Validation successful
 * - error: Validation failed
 */
export type VerificationState =
  | { status: 'waiting'; qrData: QrData }
  | { status: 'validating' }
  | { status: 'progress'; validationResults?: boolean[]; userData?: Record<string, unknown> }
  | { status: 'success'; userData: Record<string, unknown>; redirectUrl?: string }
  | { status: 'error'; error: VerificationError };

/**
 * Verification Error
 * 
 * Error information for failed verifications.
 */
export interface VerificationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
