import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

/**
 * SSE Listener Service
 * 
 * Manages Server-Sent Events (SSE) connections to the backend.
 * Listens for verification completion events.
 * 
 * **Endpoint:** `GET /api/login/events?state={state}`
 * 
 * **Event flow:**
 * 1. PWA subscribes to SSE endpoint with state parameter
 * 2. Wallet submits VP to backend via POST /oid4vp/auth-response
 * 3. Backend validates VP and sends SSE event to PWA
 * 4. PWA receives event and displays success/error UI
 * 
 * **Features:**
 * - Auto-reconnect with exponential backoff
 * - Configurable timeout
 * - Connection state monitoring
 * - Automatic cleanup on unsubscribe
 * - OAuth2 token exchange for user data extraction
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class SseListenerService {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  
  // Default timeout in milliseconds (120s)
  private readonly DEFAULT_TIMEOUT_MS = 120000;
  
  // Heartbeat timeout: if no events received after this time, assume failure
  // This handles the case where wallet submits revoked credential and backend returns 403
  // without sending SSE event (backend limitation we can't fix)
  private readonly HEARTBEAT_TIMEOUT_MS = 15000; // 15 seconds
  
  // Reconnect settings (exponential backoff)
  private readonly INITIAL_RETRY_DELAY_MS = 1000;
  private readonly MAX_RETRY_DELAY_MS = 32000;
  private readonly MAX_RETRY_ATTEMPTS = 5;

  /**
   * Get backend URL from environment
   * 
   * Reads window.env?.verifierBackendUrl with fallback to localhost:8082
   * Single source of truth defined in environment.ts
   */
  private get baseUrl(): string {
    return environment.verifierBackendUrl;
  }

  /**
   * Subscribe to verification events via SSE
   * 
   * Opens an EventSource connection to receive verification completion events.
   * Listens specifically for the 'redirect' event emitted by the backend.
   * 
   * **Event format:**
   * Event name: "redirect"
   * Event data: redirectUrl (string)
   * 
   * @param state - OAuth2 state parameter (session identifier)
   * @param timeoutMs - Optional timeout in milliseconds (default: 120s)
   * @returns Observable<LoginEvent> - Stream of verification events
   */
  public stream(state: string, timeoutMs?: number): Observable<LoginEvent> {
    const timeout = timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
    const url = `${this.baseUrl}/api/login/events?state=${encodeURIComponent(state)}`;
    
    
    return new Observable<LoginEvent>(observer => {
      let eventSource: EventSource | null = null;
      let timeoutHandle: number | null = null;
      let heartbeatHandle: number | null = null;
      let retryAttempt = 0;
      let retryTimeoutHandle: number | null = null;
      let isClosed = false;
      let eventReceived = false;  // Track if any event was received
      
      // Heartbeat checker - if no events after 15s, assume validation failed
      const startHeartbeat = () => {
        if (heartbeatHandle !== null) {
          clearTimeout(heartbeatHandle);
        }
        
        heartbeatHandle = window.setTimeout(() => {
          if (!eventReceived && !isClosed) {
            console.warn('[SseListenerService] No events received after 15s - assuming validation failed (likely revoked credential)');
            
            // Emit progress event with revocation check failed
            const failedEvent: LoginEvent = {
              type: 'progress',
              redirectUrl: undefined,
              userData: undefined,
              validationResults: [true, true, true, false], // Order: [vpSig, vcSig, issuer, revoked]
              errorCode: 'LIKELY_REVOKED',
              error: this.translate.instant('verification.error.http.credentialRevoked')
            };
            
            observer.next(failedEvent);
            cleanup();
            observer.complete();
          }
        }, this.HEARTBEAT_TIMEOUT_MS);
      };
      
      // Reset heartbeat on any event
      const resetHeartbeat = () => {
        eventReceived = true;
        if (heartbeatHandle !== null) {
          clearTimeout(heartbeatHandle);
          heartbeatHandle = null;
        }
      };
      
      // Function to establish SSE connection
      const connect = () => {
        if (isClosed) return;
        
        try {
          eventSource = new EventSource(url);
          
          // Listen for generic 'message' event (any SSE data)
          // This fires when wallet starts communicating with backend
          eventSource.addEventListener('message', (event: MessageEvent) => {
            console.log('[SseListenerService] Generic message received (wallet activity detected):', event);
            resetHeartbeat(); // Reset heartbeat timer
            
            // Emit 'validating' event to show spinner
            const validatingEvent: LoginEvent = {
              type: 'validating',
              redirectUrl: undefined,
              userData: undefined,
              errorCode: undefined,
              error: undefined
            };
            
            observer.next(validatingEvent);
            // Don't complete - wait for final 'redirect' event
          });
          
          // Listen specifically for 'redirect' event (same as MFE login)
          eventSource.addEventListener('redirect', async (event: MessageEvent) => {
            console.log('[SseListenerService] Redirect event received:', event.data);
            resetHeartbeat(); // Reset heartbeat timer
            
            // Close EventSource immediately to prevent error when backend closes connection
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            
            // Clear timeout
            if (timeoutHandle !== null) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }
            
            try {
              // Extract code from redirect URL
              const redirectUrl = event.data;
              const url = new URL(redirectUrl);
              const code = url.searchParams.get('code');
              const state = url.searchParams.get('state');
              
              if (!code) {
                console.error('[SseListenerService] No code in redirect URL');
                observer.error(new SseError('NO_CODE', this.translate.instant('verification.error.sse.noCode')));
                cleanup();
                return;
              }
              
              console.log('[SseListenerService] Exchanging code for tokens...');
              
              // Exchange code for tokens (OAuth2 token endpoint)
              const userData = await this.exchangeCodeForTokens(code, state || '');
              
              // Emit 'progress' event with user data to show technical validation checks
              // The progress component will handle animations and user must click OK to continue
              const progressEvent: LoginEvent = {
                type: 'progress',
                redirectUrl: event.data,
                userData: userData,
                validationResults: [true, true, true, true], // All checks pass
                errorCode: undefined,
                error: undefined
              };
              
              observer.next(progressEvent);
              cleanup();
              observer.complete();
            } catch (error: unknown) {
              console.error('[SseListenerService] Error processing redirect:', error);
              const errorMessage = error instanceof Error ? error.message : this.translate.instant('verification.error.sse.userDataError');
              observer.error(new SseError('TOKEN_EXCHANGE_FAILED', errorMessage));
              cleanup();
            }
          });
          
          // Listen for 'validation_failed' event (credential revoked, invalid, etc.)
          eventSource.addEventListener('validation_failed', (event: MessageEvent) => {
            resetHeartbeat(); // Reset heartbeat timer
            console.log('[SseListenerService] Validation failed event received:', event.data);
            
            // Close EventSource
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            
            // Clear timeout
            if (timeoutHandle !== null) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }
            
            try {
              // Parse error data
              const errorData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              const errorCode = errorData.code || 'VALIDATION_FAILED';
              const errorMessage = errorData.message || 'Validation failed';
              
              // Check which validation check failed based on error code
              // Order MUST match ValidationProgressComponent: [vpSignature, vcSignature, trustedIssuer, notRevoked]
              let validationResults = [true, true, true, true];
              
              if (errorCode === 'CREDENTIAL_REVOKED' || errorCode === 'STATUS_CHECK_FAILED') {
                validationResults = [true, true, true, false]; // Revocation check failed (index 3)
              } else if (errorCode === 'SIGNATURE_INVALID') {
                validationResults = [false, true, true, true]; // VP Signature check failed (index 0)
              } else if (errorCode === 'ISSUER_NOT_TRUSTED') {
                validationResults = [true, true, false, true]; // Issuer check failed (index 2)
              } else if (errorCode === 'CREDENTIAL_EXPIRED') {
                validationResults = [false, false, false, false]; // All checks fail on expiration
              }
              
              // Emit 'progress' event with failed checks
              const progressEvent: LoginEvent = {
                type: 'progress',
                redirectUrl: undefined,
                userData: undefined,
                validationResults: validationResults,
                errorCode: errorCode,
                error: errorMessage
              };
              
              observer.next(progressEvent);
              cleanup();
              observer.complete();
            } catch (parseError) {
              console.error('[SseListenerService] Error parsing validation_failed event:', parseError);
              observer.error(new SseError('VALIDATION_FAILED', event.data || 'Validation failed'));
              cleanup();
            }
          });
          
          // Handle connection open
          eventSource.addEventListener('open', () => {
            console.log('[SseListenerService] SSE connection established');
            startHeartbeat(); // Start heartbeat checker
            retryAttempt = 0; // Reset retry counter on successful connection
          });
          
          // Handle errors
          eventSource.addEventListener('error', (error: Event) => {
            const target = error.target as EventSource;
            const readyState = target?.readyState;
            const readyStateText = readyState === 0 ? 'CONNECTING' : readyState === 1 ? 'OPEN' : 'CLOSED';
            
            console.error('[SseListenerService] SSE connection error:', {
              error,
              readyState,
              readyStateText,
              url,
              retryAttempt,
              maxRetries: this.MAX_RETRY_ATTEMPTS
            });
            
            // Close current connection
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            
            // Retry with exponential backoff
            if (retryAttempt < this.MAX_RETRY_ATTEMPTS && !isClosed) {
              const delay = Math.min(
                this.INITIAL_RETRY_DELAY_MS * Math.pow(2, retryAttempt),
                this.MAX_RETRY_DELAY_MS
              );
              
              console.log(`[SseListenerService] Retrying connection in ${delay}ms (attempt ${retryAttempt + 1}/${this.MAX_RETRY_ATTEMPTS})`);
              
              retryTimeoutHandle = window.setTimeout(() => {
                retryAttempt++;
                connect();
              }, delay);
            } else {
              // Max retries exceeded
              console.error('[SseListenerService] Max retry attempts exceeded');
              observer.error(new SseError('SSE_CONNECTION_FAILED', this.translate.instant('verification.error.sse.connectionFailed')));
              cleanup();
            }
          });
          
          // Set timeout
          if (timeout > 0) {
            timeoutHandle = window.setTimeout(() => {
              console.warn('[SseListenerService] SSE timeout reached');
              observer.error(new SseError('SSE_TIMEOUT', this.translate.instant('verification.error.sse.timeout')));
              cleanup();
            }, timeout);
          }
          
        } catch (error) {
          console.error('[SseListenerService] Failed to create EventSource:', error);
          observer.error(new SseError('SSE_INIT_ERROR', this.translate.instant('verification.error.sse.initError')));
          cleanup();
        }
      };
      
      // Cleanup function
      const cleanup = () => {
        isClosed = true;
        
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        
        if (heartbeatHandle !== null) {
          clearTimeout(heartbeatHandle);
          heartbeatHandle = null;
        }
        
        if (retryTimeoutHandle !== null) {
          clearTimeout(retryTimeoutHandle);
          retryTimeoutHandle = null;
        }
      };
      
      // Start connection
      connect();
      
      // Return cleanup function (called on unsubscribe)
      return cleanup;
    });
  }

  /**
   * Exchange authorization code for tokens with PKCE
   * 
   * Calls `/oidc/token` endpoint to exchange the authorization code for an ID token.
   * Includes code_verifier from sessionStorage for PKCE validation.
   * Extracts user data from the ID token JWT claims.
   * 
   * @param code Authorization code from redirect
   * @param state OAuth2 state parameter
   * @returns User data extracted from ID token
   */
  private async exchangeCodeForTokens(code: string, state: string): Promise<Record<string, unknown>> {
    const tokenUrl = `${this.baseUrl}/oidc/token`;
    const redirectUri = window.location.origin + '/proximity/login';
    
    // Retrieve PKCE code_verifier from sessionStorage
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
    const storedState = sessionStorage.getItem('pkce_state');
    
    if (!codeVerifier) {
      console.error('[SseListenerService] No code_verifier found in sessionStorage');
      throw new Error(this.translate.instant('verification.error.sse.pkceNotFound'));
    }
    
    if (storedState !== state) {
      console.error('[SseListenerService] State mismatch:', { stored: storedState, received: state });
      throw new Error(this.translate.instant('verification.error.sse.stateMismatch'));
    }
    
    // Clean up sessionStorage
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('pkce_state');
    
    const tenantHost = window.env?.tenant ?? window.location.hostname.split('.')[0];
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: `proximity-verifier-pwa-${tenantHost}`,
      code_verifier: codeVerifier  // PKCE parameter
    });
    
    try {
      const response = await firstValueFrom(
        this.http.post<OAuth2TokenResponse>(tokenUrl, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      );
      
      console.log('[SseListenerService] Token response received');
      
      // Extract user data from ID token
      if (response.id_token) {
        const claims = this.parseJwtClaims(response.id_token);
        console.log('[SseListenerService] ID token claims:', claims);
        
        return {
          name: claims.name || claims.given_name || 'Usuario',
          given_name: claims.given_name,
          family_name: claims.family_name,
          email: claims.email,
          ...claims
        };
      }
      
      return {};
    } catch (error: unknown) {
      console.error('[SseListenerService] Token exchange error:', error);
      throw new Error(this.translate.instant('verification.error.sse.tokenExchangeError'));
    }
  }
  
  /**
   * Parse JWT claims from ID token
   * 
   * Extracts and decodes the payload from a JWT without verification
   * (verification is done by the backend during token generation).
   * 
   * @param jwt JWT string
   * @returns Decoded claims object
   */
  private parseJwtClaims(jwt: string): JwtClaims {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('[SseListenerService] Error parsing JWT:', error);
      return {};
    }
  }
}

/**
 * Login Event (from SSE)
 * 
 * Event structure returned by the backend via SSE.
 */
export interface LoginEvent {
  /** Event type */
  type: 'validating' | 'progress' | 'success' | 'error';
  
  /** Redirect URL (on success) */
  redirectUrl?: string;
  
  /** User data extracted from VP (on success) */
  userData?: Record<string, unknown> & {
    name?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
  };
  
  /** Validation results for technical checks (on progress) */
  validationResults?: boolean[];
  
  /** Error message (on error) */
  error?: string;
  
  /** Error code (on error) */
  errorCode?: string;
}

/**
 * OAuth2 Token Response
 * 
 * Response from /oidc/token endpoint
 */
interface OAuth2TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

/**
 * JWT Claims (ID Token)
 * 
 * Standard OIDC claims from ID token
 */
interface JwtClaims {
  [key: string]: unknown;
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * SSE Error
 * 
 * Custom error class for SSE connection errors.
 */
export class SseError extends Error {
  public readonly code: string;

  public constructor(
    code: string,
    message: string
  ) {
    super(message);
    this.name = 'SseError';
    this.code = code;
    
    // V8-specific stack trace capture (Node.js, Chrome)
    if ('captureStackTrace' in Error) {
      (Error as { captureStackTrace(target: object, constructor: object): void }).captureStackTrace(this, SseError);
    }
  }
}
