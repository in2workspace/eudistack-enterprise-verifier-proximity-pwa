// src/types/global.d.ts

/**
 * Global Window interface extension
 * 
 * Defines runtime environment configuration injected via env.js
 */
interface Window {
  env?: {
    /** Verifier backend URL */
    verifierBackendUrl?: string;
    
    /** SSE connection timeout in milliseconds */
    sseTimeout?: number;
    
    /** QR code expiration in seconds */
    qrExpirationSeconds?: number;
    
    /** Tenant identifier */
    tenant?: string;
    
    /** Legacy: Enable logs */
    logs_enabled?: string;
    
    /** Legacy: Verifier mode */
    verifier_mode?: string;

    /** Wallet PWA URL — used to build HTTPS QR codes scannable by the phone camera */
    walletUrl?: string;
  };
}

  