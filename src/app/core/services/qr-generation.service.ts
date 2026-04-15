import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { VerifierApiService } from './verifier-api.service';
import { environment } from '../../../environments/environment';

/**
 * QR Generation Service
 * 
 * Manages QR code generation for OID4VP verification flow.
 * Coordinates with backend to obtain authorization request JWT.
 * 
 * **Flow:**
 * 1. Generate unique sessionId (nonce)
 * 2. Call backend API to get authorization request JWT
 * 3. Return QR data with URI and expiration info
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class QrGenerationService {
  private readonly verifierApi = inject(VerifierApiService);
  
  // QR expiration in seconds (default: 120s = 2 minutes)
  private readonly QR_EXPIRATION_SECONDS = this.getQrExpiration();

  /**
   * Generate QR code data
   * 
   * Calls backend POST /api/proximity/initiate to create a new verification session.
   * Backend generates the authRequest JWT and returns it ready for QR display.
   * 
   * @returns Observable<QrData> - QR code data with URI and metadata
   */
  public generateQr(): Observable<QrData> {
    console.log('[QrGenerationService] Initiating verification session with backend');
    
    return this.verifierApi.initiateVerification().pipe(
      map(session => {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.QR_EXPIRATION_SECONDS * 1000);
        
        console.log('[QrGenerationService] Session created:', {
          sessionId: session.sessionId,
          state: session.state,
          expiresAt,
          authRequestLength: session.authRequest.length
        });
        
        return {
          uri: this.toWalletUrl(session.authRequest),
          sessionId: session.sessionId,
          state: session.state,
          expiresAt,
          createdAt: now
        };
      })
    );
  }

  /**
   * Create QR from received authRequest (cross-device flow)
   * 
   * Used when the PWA is invoked from a backend redirect with authRequest URL.
   * No backend API call needed - the authRequest is already complete.
   * 
   * @param authRequest - Full openid4vp:// URL from backend
   * @param state - OAuth2 state parameter for SSE connection
   * @returns Observable<QrData> - QR code data
   */
  public createFromAuthRequest(authRequest: string, state: string): Observable<QrData> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.QR_EXPIRATION_SECONDS * 1000);
    
    console.log('[QrGenerationService] Creating QR from authRequest:', {
      authRequestLength: authRequest.length,
      state,
      expiresAt
    });
    
    return of({
      uri: this.toWalletUrl(authRequest),
      sessionId: this.extractSessionIdFromAuthRequest(authRequest),
      state,
      expiresAt,
      createdAt: now
    });
  }

  /**
   * Regenerate QR code
   * 
   * Creates a new QR with a fresh session.
   * Used when the previous QR expires.
   * 
   * @returns Observable<QrData>
   */
  public regenerateQr(): Observable<QrData> {
    console.log('[QrGenerationService] Regenerating QR');
    return this.generateQr();
  }

  /**
   * Transform an openid4vp:// URI into a wallet HTTPS callback URL.
   *
   * Mirrors the same-device flow used by `eudistack-mfe-login` so the wallet
   * has a single entry point (`/protocol/callback?authorization_request=...`)
   * for both cross-device (QR scan) and same-device (button) flows.
   *
   * Input:  openid4vp://?client_id=xxx&request_uri=https://verifier/oid4vp/abc
   * Output: https://wallet.domain/protocol/callback?authorization_request=<URL-encoded openid4vp://...>
   */
  private toWalletUrl(authRequest: string): string {
    const walletBase = environment.walletUrl;

    if (!walletBase || !authRequest.startsWith('openid4vp://')) {
      return authRequest;
    }

    const base = walletBase.replace(/\/+$/, '');
    const target = `${base}/protocol/callback?authorization_request=${encodeURIComponent(authRequest)}`;

    console.log('[QrGenerationService] QR transformed to wallet callback URL:', target);
    return target;
  }

  /**
   * Extract sessionId from authRequest URL
   * Parses the request_uri parameter to get the session ID (nonce)
   */
  private extractSessionIdFromAuthRequest(authRequest: string): string {
    try {
      // authRequest format: openid4vp://?client_id=...&request_uri=https://.../{sessionId}
      const url = new URL(authRequest);
      const requestUri = url.searchParams.get('request_uri');
      if (requestUri) {
        const parts = requestUri.split('/');
        return parts[parts.length - 1]; // Last segment is sessionId
      }
    } catch (error) {
      console.warn('[QrGenerationService] Failed to extract sessionId:', error);
    }
    return 'unknown';
  }

  /**
   * Get QR expiration from configuration
   * 
   * Priority:
   * 1. window["env"]["qrExpirationSeconds"]
   * 2. Default: 120 seconds
   * 
   * @returns Expiration in seconds
   */
  private getQrExpiration(): number {
    const configValue = window.env?.qrExpirationSeconds;
    
    if (typeof configValue === 'number' && configValue > 0) {
      return configValue;
    }
    
    return 120; // Default: 2 minutes
  }
}

/**
 * QR Data
 * 
 * Data structure for QR code generation.
 */
export interface QrData {
  /** OID4VP URI (authorization request JWT) */
  uri: string;
  
  /** Session ID (nonce) */
  sessionId: string;
  
  /** OAuth2 state parameter */
  state: string;
  
  /** Expiration timestamp */
  expiresAt: Date;
  
  /** Creation timestamp */
  createdAt: Date;
}
