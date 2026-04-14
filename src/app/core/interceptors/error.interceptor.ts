import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { throwError, timer, retry } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * HTTP Error Interceptor
 * 
 * Centralized error handling for all HTTP requests.
 * 
 * **Features:**
 * - Automatic retry with exponential backoff (5xx errors only)
 * - Error logging
 * - User-friendly error messages
 * - CORS detection
 * 
 * **Retry policy:**
 * - Max 3 retries
 * - Exponential backoff: 1s, 2s, 4s
 * - Only for server errors (5xx)
 * - No retry for client errors (4xx)
 * 
 * @functional interceptor (Angular 19)
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    retry({
      count: 3,
      delay: (error: HttpErrorResponse, retryCount: number) => {
        // Only retry on server errors (5xx)
        if (error.status >= 500 && error.status < 600) {
          const delayMs = Math.pow(2, retryCount - 1) * 1000; // 1s, 2s, 4s
          console.log(
            `[ErrorInterceptor] Retrying request (attempt ${retryCount}/3) in ${delayMs}ms`,
            { url: req.url, status: error.status }
          );
          return timer(delayMs);
        }
        
        // Don't retry on client errors or network errors
        throw error;
      }
    }),
    catchError((error: HttpErrorResponse) => {
      const enrichedError = enrichError(error, req.url);
      
      console.error('[ErrorInterceptor] HTTP request failed:', {
        url: req.url,
        status: error.status,
        message: enrichedError.message,
        error: error
      });
      
      return throwError(() => enrichedError);
    })
  );
};

/**
 * Enrich error with user-friendly information
 * 
 * Maps HTTP status codes to error codes and English messages.
 * Both code and message are attached to the error for downstream consumers.
 * 
 * NOTE: Uses hardcoded English messages to avoid circular dependency with TranslateService.
 * Components can translate error codes themselves if needed.
 * 
 * @param error - Original HTTP error
 * @param url - Request URL
 * @returns Enriched error response with code and message
 */
function enrichError(error: HttpErrorResponse, url: string): HttpErrorResponse {
  let code = 'UNKNOWN_ERROR';
  let message = 'An unexpected error occurred';
  
  if (error.status === 0) {
    // Network error or CORS
    code = 'NETWORK_ERROR';
    message = 'Network error. Please check your connection.';
  } else if (error.status === 404) {
    code = 'SESSION_NOT_FOUND';
    message = 'Session not found';
  } else if (error.status === 408 || (error as unknown as { name?: string }).name === 'TimeoutError') {
    code = 'TIMEOUT';
    message = 'Request timeout';
  } else if (error.status === 401) {
    code = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (error.status === 403) {
    // 403 can mean credential revoked or other forbidden access
    code = 'FORBIDDEN';
    // Check if response body contains revocation info
    if (error.error?.message?.toLowerCase().includes('revoked') || 
        error.error?.message?.toLowerCase().includes('revocada')) {
      code = 'CREDENTIAL_REVOKED';
      message = 'Credential has been revoked';
    } else {
      message = 'Access forbidden';
    }
  } else if (error.status >= 500) {
    code = 'SERVER_ERROR';
    message = 'Server error. Please try again later.';
  } else if (error.status >= 400) {
    code = 'BAD_REQUEST';
    message = error.error?.message || 'Invalid request';
  }
  
  // Create enriched error with structured error body
  const enriched = new HttpErrorResponse({
    error: {
      code,
      message,
      originalError: error.error
    },
    headers: error.headers,
    status: error.status,
    statusText: message,
    url: url
  });
  
  return enriched;
}
