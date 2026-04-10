import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

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
  // Backend URL from environment or window.env
  private readonly baseUrl = this.getBackendUrl();
  
  // Default timeout in milliseconds (120s)
  private readonly DEFAULT_TIMEOUT_MS = 120000;
  
  // Reconnect settings (exponential backoff)
  private readonly INITIAL_RETRY_DELAY_MS = 1000;
  private readonly MAX_RETRY_DELAY_MS = 32000;
  private readonly MAX_RETRY_ATTEMPTS = 5;

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
  public subscribe(state: string, timeoutMs?: number): Observable<LoginEvent> {
    const timeout = timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
    const url = `${this.baseUrl}/api/login/events?state=${encodeURIComponent(state)}`;
    
    console.log('[SseListenerService] Subscribing to SSE:', { state, url, timeout });
    
    return new Observable<LoginEvent>(observer => {
      let eventSource: EventSource | null = null;
      let timeoutHandle: number | null = null;
      let retryAttempt = 0;
      let retryTimeoutHandle: number | null = null;
      let isClosed = false;
      
      // Function to establish SSE connection
      const connect = () => {
        if (isClosed) return;
        
        try {
          eventSource = new EventSource(url);
          
          // Listen for generic 'message' event (any SSE data)
          // This fires when wallet starts communicating with backend
          eventSource.addEventListener('message', (event: MessageEvent) => {
            console.log('[SseListenerService] Generic message received (wallet activity detected):', event);
            
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
            
            try {
              // Extract code from redirect URL
              const redirectUrl = event.data;
              const url = new URL(redirectUrl);
              const code = url.searchParams.get('code');
              const state = url.searchParams.get('state');
              
              if (!code) {
                console.error('[SseListenerService] No code in redirect URL');
                observer.error(new SseError('NO_CODE', 'No se recibió código de autorización'));
                cleanup();
                return;
              }
              
              console.log('[SseListenerService] Exchanging code for tokens...');
              
              // Exchange code for tokens (OAuth2 token endpoint)
              const userData = await this.exchangeCodeForTokens(code, state || '');
              
              const successEvent: LoginEvent = {
                type: 'success',
                redirectUrl: event.data,
                userData,
                errorCode: undefined,
                error: undefined
              };
              
              observer.next(successEvent);
              cleanup();
              observer.complete();
            } catch (error: unknown) {
              console.error('[SseListenerService] Error processing redirect:', error);
              const errorMessage = error instanceof Error ? error.message : 'Error al obtener datos de usuario';
              observer.error(new SseError('TOKEN_EXCHANGE_FAILED', errorMessage));
              cleanup();
            }
          });
          
          // Handle connection open
          eventSource.addEventListener('open', () => {
            console.log('[SseListenerService] SSE connection established');
            retryAttempt = 0; // Reset retry counter on successful connection
          });
          
          // Handle errors
          eventSource.addEventListener('error', (error: Event) => {
            console.error('[SseListenerService] SSE connection error:', error);
            
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
              observer.error(new SseError('SSE_CONNECTION_FAILED', 'No se pudo conectar con el servidor'));
              cleanup();
            }
          });
          
          // Set timeout
          if (timeout > 0) {
            timeoutHandle = window.setTimeout(() => {
              console.warn('[SseListenerService] SSE timeout reached');
              observer.error(new SseError('SSE_TIMEOUT', 'Tiempo de espera agotado'));
              cleanup();
            }, timeout);
          }
          
        } catch (error) {
          console.error('[SseListenerService] Failed to create EventSource:', error);
          observer.error(new SseError('SSE_INIT_ERROR', 'Error al inicializar conexión SSE'));
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
    const redirectUri = window.location.origin + '/login';
    
    // Retrieve PKCE code_verifier from sessionStorage
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
    const storedState = sessionStorage.getItem('pkce_state');
    
    if (!codeVerifier) {
      console.error('[SseListenerService] No code_verifier found in sessionStorage');
      throw new Error('PKCE code_verifier no encontrado');
    }
    
    if (storedState !== state) {
      console.error('[SseListenerService] State mismatch:', { stored: storedState, received: state });
      throw new Error('Estado OAuth2 no coincide');
    }
    
    // Clean up sessionStorage
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('pkce_state');
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: 'proximity-verifier-pwa',
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
      throw new Error('Error al intercambiar código por tokens');
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

  /**
   * Get backend URL from configuration
   * 
   * Priority:
   * 1. window["env"]["verifierBackendUrl"] (runtime config)
   * 2. Fallback to localhost:8082
   * 
   * @returns Backend base URL
   */
  private getBackendUrl(): string {
    const runtimeUrl = window.env?.verifierBackendUrl;
    
    if (runtimeUrl) {
      return runtimeUrl;
    }
    
    return 'http://localhost:8082';
  }
}

/**
 * Login Event (from SSE)
 * 
 * Event structure returned by the backend via SSE.
 */
export interface LoginEvent {
  /** Event type */
  type: 'validating' | 'success' | 'error';
  
  /** Redirect URL (on success) */
  redirectUrl?: string;
  
  /** User data extracted from VP (on success) */
  userData?: Record<string, unknown> & {
    name?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
  };
  
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
