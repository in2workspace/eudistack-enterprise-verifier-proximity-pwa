import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

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
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class SseListenerService {
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
          eventSource.addEventListener('redirect', (event: MessageEvent) => {
            console.log('[SseListenerService] Redirect event received:', event.data);
            
            // For proximity flow, redirectUrl might not be relevant
            // But we receive success notification
            const successEvent: LoginEvent = {
              type: 'success',
              redirectUrl: event.data,
              userData: {}, // TODO: Extract from VP in backend
              errorCode: undefined,
              error: undefined
            };
            
            observer.next(successEvent);
            cleanup();
            observer.complete();
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
   * Get backend URL from configuration
   * 
   * Priority:
   * 1. window["env"]["verifierBackendUrl"] (runtime config)
   * 2. Fallback to localhost:8081
   * 
   * @returns Backend base URL
   */
  private getBackendUrl(): string {
    const runtimeUrl = (window as any)["env"]?.["verifierBackendUrl"];
    
    if (runtimeUrl) {
      return runtimeUrl;
    }
    
    return 'http://localhost:8081';
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
  userData?: {
    name?: string;
    email?: string;
    [key: string]: any;
  };
  
  /** Error message (on error) */
  error?: string;
  
  /** Error code (on error) */
  errorCode?: string;
}

/**
 * SSE Error
 * 
 * Custom error class for SSE connection errors.
 */
export class SseError extends Error {
  public readonly code: string;

  constructor(
    code: string,
    message: string
  ) {
    super(message);
    this.name = 'SseError';
    this.code = code;
    
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, SseError);
    }
  }
}
