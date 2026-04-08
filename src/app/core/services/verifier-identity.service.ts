import { Injectable } from '@angular/core';
import { CryptoService, VerifierIdentity } from './crypto.service';

/**
 * Verifier Identity Service
 * 
 * Manages the verifier's cryptographic identity (DID:key).
 * Generates an ephemeral P-256 keypair on first access and caches it.
 * 
 * Similar to CryptoComponent in core verifier.
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class VerifierIdentityService {
  private identity: VerifierIdentity | null = null;
  private initPromise: Promise<VerifierIdentity> | null = null;

  constructor(private readonly cryptoService: CryptoService) {}

  /**
   * Get or generate verifier identity
   * 
   * Lazily generates an ephemeral P-256 keypair and DID:key on first call.
   * Subsequent calls return the cached identity.
   * 
   * ⚠️ Note: This generates a new DID on every app reload.
   * For production, consider persisting the keypair in IndexedDB.
   * 
   * @returns Verifier identity with clientId (did:key) and keypair
   */
  public async getIdentity(): Promise<VerifierIdentity> {
    // Return cached identity if available
    if (this.identity) {
      return this.identity;
    }

    // If already initializing, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Initialize identity
    this.initPromise = this.initializeIdentity();
    this.identity = await this.initPromise;
    this.initPromise = null;

    return this.identity;
  }

  /**
   * Get client_id (DID:key) for OID4VP
   * 
   * @returns DID:key identifier
   */
  public async getClientId(): Promise<string> {
    const identity = await this.getIdentity();
    return identity.clientId;
  }

  /**
   * Get client_id_scheme for OID4VP
   * 
   * Always returns 'did' (only did:key is supported)
   * 
   * @returns 'did'
   */
  public getClientIdScheme(): string {
    return 'did';
  }

  /**
   * Get keypair for signing operations
   * 
   * @returns CryptoKeyPair
   */
  public async getKeyPair(): Promise<CryptoKeyPair> {
    const identity = await this.getIdentity();
    return identity.keypair;
  }

  /**
   * Initialize verifier identity
   * 
   * Generates ephemeral P-256 keypair and derives DID:key
   */
  private async initializeIdentity(): Promise<VerifierIdentity> {
    console.log('[VerifierIdentity] Generating ephemeral P-256 key + did:key');
    
    const identity = await this.cryptoService.generateVerifierIdentity();
    
    console.log('[VerifierIdentity] Generated did:key:', identity.clientId);
    console.warn(
      '[VerifierIdentity] Using ephemeral key. ' +
      'DID will change on app reload. ' +
      'For production, persist keypair in IndexedDB.'
    );
    
    return identity;
  }

  /**
   * Reset identity (for testing)
   * 
   * Clears cached identity, forcing regeneration on next access
   */
  public reset(): void {
    this.identity = null;
    this.initPromise = null;
  }
}
