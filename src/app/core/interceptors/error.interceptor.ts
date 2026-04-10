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
 * @param error - Original HTTP error
 * @param url - Request URL
 * @returns Enriched error response
 */
function enrichError(error: HttpErrorResponse, url: string): HttpErrorResponse {
  let message = 'Error desconocido';
  
  if (error.status === 0) {
    // Network error or CORS
    message = 'No se puede conectar con el servidor. Verifica tu conexión o configuración CORS.';
  } else if (error.status === 404) {
    message = 'Recurso no encontrado';
  } else if (error.status === 408 || (error as unknown as { name?: string }).name === 'TimeoutError') {
    message = 'Tiempo de espera agotado';
  } else if (error.status === 401) {
    message = 'No autorizado';
  } else if (error.status === 403) {
    message = 'Acceso denegado';
  } else if (error.status >= 500) {
    message = 'Error del servidor. Inténtalo de nuevo más tarde.';
  } else if (error.status >= 400) {
    message = error.error?.message || 'Solicitud inválida';
  }
  
  // Create enriched error preserving original data
  const enriched = new HttpErrorResponse({
    error: error.error,
    headers: error.headers,
    status: error.status,
    statusText: error.statusText || message,
    url: url
  });
  
  return enriched;
}
