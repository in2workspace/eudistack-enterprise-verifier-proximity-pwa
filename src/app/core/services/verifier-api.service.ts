import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { VerificationSession } from '../models';
import { environment } from '../../../environments/environment';



/**
 * Verifier API Service
 * 
 * HTTP client for consuming the eudistack-core-verifier backend.
 * 
 * **Endpoints consumed:**
 * - `POST /api/proximity/initiate` - Inicia sesión de verificación (new)
 * - `GET /oid4vp/auth-request/{id}` - Obtiene el JWT de authorization request (legacy)
 * 
 * **Backend:** eudistack-core-verifier (Java Spring WebMvc)
 * **Protocol:** OID4VP 1.0
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class VerifierApiService {
  private readonly http = inject(HttpClient);
  
  // HTTP timeout in milliseconds (30s)
  private readonly HTTP_TIMEOUT_MS = 30000;

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
   * Initiate a new proximity verification session
   * 
   * Calls: POST /api/proximity/initiate
   * 
   * The backend creates a new verification session, generates the authorization
   * request JWT, caches it, and returns the complete data for QR display.
   * 
   * @returns Observable<VerificationSession> - Session data with authRequest URL
   * @throws VerifierApiError if request fails
   */
  public initiateVerification(): Observable<VerificationSession> {
    const url = `${this.baseUrl}/api/proximity/initiate`;
    
    console.log('[VerifierApiService] Initiating verification:', { url });
    
    return this.http.post<VerificationSession>(url, {}).pipe(
      timeout(this.HTTP_TIMEOUT_MS),
      catchError((error: HttpErrorResponse) => {
        console.error('[VerifierApiService] Initiate verification failed:', error);
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get authorization request JWT from backend (legacy - for cross-device flow)
   * 
   * Calls: GET /oid4vp/auth-request/{id}
   * 
   * The backend returns a signed JWT that the PWA displays in a QR code.
   * The wallet scans the QR and processes the authorization request.
   * 
   * @param sessionId - Unique session ID (nonce)
   * @returns Observable<string> - Authorization request JWT
   * @throws VerifierApiError if request fails
   */
  public getAuthRequest(sessionId: string): Observable<string> {
    const url = `${this.baseUrl}/oid4vp/auth-request/${sessionId}`;
    
    console.log('[VerifierApiService] Fetching auth request:', { sessionId, url });
    
    return this.http.get(url, { responseType: 'text' }).pipe(
      timeout(this.HTTP_TIMEOUT_MS),
      catchError((error: HttpErrorResponse) => {
        console.error('[VerifierApiService] Get auth request failed:', error);
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Handle HTTP errors
   * 
   * Converts HttpErrorResponse to VerifierApiError with user-friendly messages.
   * 
   * @param error - HTTP error response
   * @returns VerifierApiError
   */
  private handleError(error: HttpErrorResponse): VerifierApiError {
    let message = 'Error desconocido';
    let code = 'UNKNOWN_ERROR';
    
    if (error.status === 0) {
      // Network error or CORS issue
      code = 'NETWORK_ERROR';
      message = 'No se puede conectar con el servidor. Verifica tu conexión.';
    } else if (error.status === 404) {
      code = 'SESSION_NOT_FOUND';
      message = 'Sesión no encontrada o expirada';
    } else if (error.status === 408 || (error as unknown as { name?: string }).name === 'TimeoutError') {
      code = 'TIMEOUT';
      message = 'Tiempo de espera agotado';
    } else if (error.status >= 500) {
      code = 'SERVER_ERROR';
      message = 'Error del servidor';
    } else if (error.status >= 400) {
      code = 'BAD_REQUEST';
      message = error.error?.message || 'Solicitud inválida';
    }
    
    return new VerifierApiError(code, message, error.status, error);
  }
}

/**
 * Verifier API Error
 * 
 * Custom error class for API errors with structured information.
 */
export class VerifierApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly originalError?: unknown;

  public constructor(
    code: string,
    message: string,
    statusCode: number = 0,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'VerifierApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    
    // Maintain proper stack trace (only available in V8 engines like Chrome/Node.js)
    if ('captureStackTrace' in Error && typeof (Error as { captureStackTrace?: unknown }).captureStackTrace === 'function') {
      (Error as { captureStackTrace(target: object, constructor: object): void }).captureStackTrace(this, VerifierApiError);
    }
  }
}
