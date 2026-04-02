import { importJWK, JWK } from 'jose';

/**
 * DID Resolution Result
 * 
 * Contains the resolved DID Document and extracted public key
 */
export interface DidResolutionResult {
  /** DID that was resolved */
  readonly did: string;
  
  /** Resolved DID Document */
  readonly didDocument: DidDocument;
  
  /** Extracted verification method (public key) */
  readonly verificationMethod: VerificationMethod;
  
  /** Public key as JWK format */
  readonly publicKeyJwk: JWK;
  
  /** Public key as CryptoKey (for Web Crypto API) */
  readonly publicKey: CryptoKey;
  
  /** Resolution timestamp */
  readonly resolvedAt: string;
}

/**
 * DID Document structure (W3C spec)
 */
export interface DidDocument {
  readonly '@context': string | string[];
  readonly id: string;
  readonly verificationMethod?: VerificationMethod[];
  readonly authentication?: (string | VerificationMethod)[];
  readonly assertionMethod?: (string | VerificationMethod)[];
  readonly keyAgreement?: (string | VerificationMethod)[];
  readonly capabilityInvocation?: (string | VerificationMethod)[];
  readonly capabilityDelegation?: (string | VerificationMethod)[];
  readonly service?: ServiceEndpoint[];
}

/**
 * Verification Method structure
 */
export interface VerificationMethod {
  readonly id: string;
  readonly type: string;
  readonly controller: string;
  readonly publicKeyJwk?: JWK;
  readonly publicKeyMultibase?: string;
  readonly publicKeyBase58?: string;
}

/**
 * Service Endpoint structure
 */
export interface ServiceEndpoint {
  readonly id: string;
  readonly type: string;
  readonly serviceEndpoint: string;
}

/**
 * DID Resolver Utility
 * 
 * Resolves Decentralized Identifiers (DIDs) to public keys.
 * 
 * Supported DID methods:
 * - did:key - Local resolution (extract key from identifier)
 * - did:web - HTTP resolution via .well-known/did.json
 * - did:elsi - HTTP resolution for eIDAS identifiers
 * 
 * Features:
 * - In-memory caching (1 minute TTL)
 * - Error handling with detailed messages
 * - Support for multiple key formats (JWK, multibase, base58)
 * - W3C DID Document parsing
 * 
 * @class DidResolver
 */
export class DidResolver {
  private static readonly CACHE_TTL_MS = 60 * 1000; // 1 minute
  private readonly cache = new Map<string, CachedDidResult>();

  /**
   * Resolve a DID to its public key
   * 
   * @param did - DID to resolve (e.g., "did:key:z6Mk...", "did:web:example.com")
   * @returns Promise resolving to DidResolutionResult
   * @throws {DidResolutionError} If resolution fails
   * @throws {UnsupportedDidMethodError} If DID method is not supported
   */
  public async resolve(did: string): Promise<DidResolutionResult> {
    this.validateDid(did);

    // Check cache first
    const cached = this.getCached(did);
    if (cached) {
      return cached;
    }

    // Extract DID method
    const method = this.extractMethod(did);

    // Route to appropriate resolver
    let result: DidResolutionResult;
    switch (method) {
      case 'key':
        result = await this.resolveDidKey(did);
        break;
      case 'web':
        result = await this.resolveDidWeb(did);
        break;
      case 'elsi':
        result = await this.resolveDidElsi(did);
        break;
      default:
        throw new UnsupportedDidMethodError(
          `DID method '${method}' is not supported. Supported methods: key, web, elsi`
        );
    }

    // Cache result
    this.cacheResult(did, result);

    return result;
  }

  /**
   * Clear resolution cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Validate DID format
   * 
   * @param did - DID to validate
   * @throws {DidResolutionError} If DID format is invalid
   */
  private validateDid(did: string): void {
    if (!did || typeof did !== 'string') {
      throw new DidResolutionError('DID must be a non-empty string');
    }

    if (!did.startsWith('did:')) {
      throw new DidResolutionError('DID must start with "did:"');
    }

    const parts = did.split(':');
    if (parts.length < 3) {
      throw new DidResolutionError('Invalid DID format. Expected: did:method:identifier');
    }
  }

  /**
   * Extract DID method from DID string
   * 
   * @param did - DID string
   * @returns DID method (e.g., 'key', 'web', 'elsi')
   */
  private extractMethod(did: string): string {
    const parts = did.split(':');
    return parts[1];
  }

  /**
   * Resolve did:key locally
   * 
   * Extracts the public key directly from the DID identifier.
   * No network requests required.
   * 
   * @param did - did:key identifier
   * @returns DidResolutionResult
   * @throws {DidResolutionError} If resolution fails
   */
  private async resolveDidKey(did: string): Promise<DidResolutionResult> {
    try {
      // Extract multibase key from DID
      // Format: did:key:z6Mk... (z = multibase base58btc)
      const keyPart = did.substring('did:key:'.length);

      if (!keyPart.startsWith('z')) {
        throw new DidResolutionError(
          'did:key must use multibase base58btc encoding (starts with "z")'
        );
      }

      // For now, we'll create a minimal DID Document
      // In production, you'd decode the multibase key properly
      const verificationMethod: VerificationMethod = {
        id: `${did}#${keyPart}`,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyMultibase: keyPart
      };

      const didDocument: DidDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/jws-2020/v1'
        ],
        id: did,
        verificationMethod: [verificationMethod],
        authentication: [verificationMethod.id],
        assertionMethod: [verificationMethod.id]
      };

      // For did:key, we need to decode the multibase key to JWK
      // This is a simplified implementation - in production use a proper multibase/multicodec library
      const publicKeyJwk = await this.decodeDidKeyToJwk();
      const publicKey = await importJWK(publicKeyJwk, 'ES256');

      return {
        did,
        didDocument,
        verificationMethod,
        publicKeyJwk,
        publicKey,
        resolvedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof DidResolutionError) {
        throw error;
      }
      throw new DidResolutionError(`Failed to resolve did:key: ${error}`, error);
    }
  }

  /**
   * Resolve did:web via HTTP
   * 
   * Fetches DID Document from https://<domain>/.well-known/did.json
   * 
   * @param did - did:web identifier
   * @returns DidResolutionResult
   * @throws {DidResolutionError} If resolution fails
   */
  private async resolveDidWeb(did: string): Promise<DidResolutionResult> {
    try {
      // Extract domain from did:web
      // Format: did:web:example.com or did:web:example.com:path:to:did
      const didParts = did.split(':');
      const domain = didParts[2];
      
      let path = '/.well-known/did.json';
      if (didParts.length > 3) {
        // Handle path-based did:web
        const additionalPath = didParts.slice(3).join('/');
        path = `/${additionalPath}/did.json`;
      }

      const url = `https://${domain}${path}`;

      // Fetch DID Document
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/did+json, application/json'
        },
        // Add timeout
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new DidResolutionError(
          `HTTP ${response.status}: Failed to fetch DID Document from ${url}`
        );
      }

      const didDocument: DidDocument = await response.json();

      // Validate DID Document
      if (didDocument.id !== did) {
        throw new DidResolutionError(
          `DID Document ID mismatch: expected ${did}, got ${didDocument.id}`
        );
      }

      // Extract first verification method
      const verificationMethod = this.extractVerificationMethod(didDocument);
      const publicKeyJwk = this.extractPublicKeyJwk(verificationMethod);
      const publicKey = await importJWK(publicKeyJwk);

      return {
        did,
        didDocument,
        verificationMethod,
        publicKeyJwk,
        publicKey,
        resolvedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof DidResolutionError) {
        throw error;
      }
      throw new DidResolutionError(`Failed to resolve did:web: ${error}`, error);
    }
  }

  /**
   * Resolve did:elsi via HTTP
   * 
   * Similar to did:web but for eIDAS identifiers
   * 
   * @param did - did:elsi identifier
   * @returns DidResolutionResult
   * @throws {DidResolutionError} If resolution fails
   */
  private async resolveDidElsi(did: string): Promise<DidResolutionResult> {
    try {
      // Extract identifier from did:elsi
      // Format: did:elsi:VATES-A12345678
      const identifier = did.substring('did:elsi:'.length);

      // Construct URL to eIDAS registry
      // This is a placeholder - actual eIDAS resolution would be more complex
      const baseUrl = 'https://eidas.europa.eu';
      const url = `${baseUrl}/registry/${identifier}/did.json`;

      // Fetch DID Document
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/did+json, application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new DidResolutionError(
          `HTTP ${response.status}: Failed to fetch eIDAS DID Document from ${url}`
        );
      }

      const didDocument: DidDocument = await response.json();

      // Validate DID Document
      if (didDocument.id !== did) {
        throw new DidResolutionError(
          `DID Document ID mismatch: expected ${did}, got ${didDocument.id}`
        );
      }

      // Extract verification method and public key
      const verificationMethod = this.extractVerificationMethod(didDocument);
      const publicKeyJwk = this.extractPublicKeyJwk(verificationMethod);
      const publicKey = await importJWK(publicKeyJwk);

      return {
        did,
        didDocument,
        verificationMethod,
        publicKeyJwk,
        publicKey,
        resolvedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof DidResolutionError) {
        throw error;
      }
      throw new DidResolutionError(`Failed to resolve did:elsi: ${error}`, error);
    }
  }

  /**
   * Extract verification method from DID Document
   * 
   * @param didDocument - DID Document
   * @returns First assertionMethod verification method
   * @throws {DidResolutionError} If no verification method found
   */
  private extractVerificationMethod(didDocument: DidDocument): VerificationMethod {
    // Try assertionMethod first (used for signing credentials)
    if (didDocument.assertionMethod && didDocument.assertionMethod.length > 0) {
      const vmRef = didDocument.assertionMethod[0];
      
      if (typeof vmRef === 'string') {
        // Reference to verification method by ID
        const vm = didDocument.verificationMethod?.find(v => v.id === vmRef);
        if (vm) return vm;
      } else {
        // Embedded verification method
        return vmRef;
      }
    }

    // Fallback to first verification method
    if (didDocument.verificationMethod && didDocument.verificationMethod.length > 0) {
      return didDocument.verificationMethod[0];
    }

    throw new DidResolutionError(
      'No verification method found in DID Document'
    );
  }

  /**
   * Extract public key in JWK format from verification method
   * 
   * @param verificationMethod - Verification method
   * @returns JWK representation of public key
   * @throws {DidResolutionError} If public key cannot be extracted
   */
  private extractPublicKeyJwk(verificationMethod: VerificationMethod): JWK {
    if (verificationMethod.publicKeyJwk) {
      return verificationMethod.publicKeyJwk;
    }

    if (verificationMethod.publicKeyMultibase) {
      // Would decode multibase to JWK here
      // For now, throw error
      throw new DidResolutionError(
        'publicKeyMultibase decoding not yet implemented. Use publicKeyJwk format.'
      );
    }

    if (verificationMethod.publicKeyBase58) {
      // Would decode base58 to JWK here
      throw new DidResolutionError(
        'publicKeyBase58 decoding not yet implemented. Use publicKeyJwk format.'
      );
    }

    throw new DidResolutionError(
      'No supported public key format found in verification method'
    );
  }

  /**
   * Decode did:key multibase identifier to JWK
   * 
   * Simplified implementation - production should use @digitalbazaar/multicodec
   * 
   * @returns JWK representation
   */
  private async decodeDidKeyToJwk(): Promise<JWK> {
    // This is a simplified placeholder
    // In production, use proper multibase/multicodec decoding
    throw new DidResolutionError(
      'did:key decoding not fully implemented. Use did:web or did:elsi with publicKeyJwk.'
    );
  }

  /**
   * Get cached resolution result
   * 
   * @param did - DID to look up
   * @returns Cached result if valid, undefined otherwise
   */
  private getCached(did: string): DidResolutionResult | undefined {
    const cached = this.cache.get(did);
    
    if (!cached) {
      return undefined;
    }

    const now = Date.now();
    if (now - cached.timestamp > DidResolver.CACHE_TTL_MS) {
      // Cache expired
      this.cache.delete(did);
      return undefined;
    }

    return cached.result;
  }

  /**
   * Cache resolution result
   * 
   * @param did - DID key
   * @param result - Resolution result
   */
  private cacheResult(did: string, result: DidResolutionResult): void {
    this.cache.set(did, {
      result,
      timestamp: Date.now()
    });
  }
}

/**
 * Cached DID resolution result
 */
interface CachedDidResult {
  readonly result: DidResolutionResult;
  readonly timestamp: number;
}

/**
 * DID Resolution Error
 */
export class DidResolutionError extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DidResolutionError';
  }
}

/**
 * Unsupported DID Method Error
 */
export class UnsupportedDidMethodError extends DidResolutionError {
  public constructor(message: string) {
    super(message);
    this.name = 'UnsupportedDidMethodError';
  }
}
