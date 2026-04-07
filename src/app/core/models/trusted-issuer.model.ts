/**
 * Represents a trusted credential issuer.
 * 
 * Part of the trust framework configuration.
 * Loaded from assets/trust-framework/trusted-issuers.json
 * and cached in IndexedDB.
 * 
 * @interface TrustedIssuer
 */
export interface TrustedIssuer {
  /**
   * Unique issuer identifier (DID or URL)
   * Examples: 
   * - did:web:issuer.example.com
   * - did:key:z6Mkf...
   * - did:elsi:VATES-A12345678
   */
  issuerId: string;

  /**
   * Human-readable issuer name
   */
  name: string;

  /**
   * Issuer description
   */
  description?: string;

  /**
   * Issuer's JWKS URI for public key retrieval
   * Optional if using DID-based resolution
   */
  jwksUri?: string;

  /**
   * Issuer logo URL (for UI display)
   */
  logoUrl?: string;

  /**
   * Issuer country code (ISO 3166-1 alpha-2)
   */
  country?: string;

  /**
   * eIDAS identifier (if applicable)
   * Example: VATES-A12345678
   */
  eidasId?: string;

  /**
   * Credential types this issuer can issue
   */
  credentialTypes: string[];

  /**
   * Whether this is an eIDAS-compliant issuer
   */
  isEidas: boolean;

  /**
   * Supported cryptographic algorithms
   */
  supportedAlgorithms?: string[];

  /**
   * Trust level (1-5)
   * 1 = Low (testing), 2 = Medium (pilot), 3 = High (production qualified),
   * 4 = Very High (government), 5 = Maximum (eIDAS)
   */
  trustLevel: 1 | 2 | 3 | 4 | 5;

  /**
   * Issuer status
   */
  status: IssuerStatus;

  /**
   * Last update timestamp (ISO 8601)
   */
  lastUpdated: string;
}

/**
 * Issuer lifecycle status
 */
export enum IssuerStatus {
  /** Issuer is active and trusted */
  ACTIVE = 'active',
  
  /** Issuer is suspended (temporarily untrusted) */
  SUSPENDED = 'suspended',
  
  /** Issuer is revoked (permanently untrusted) */
  REVOKED = 'revoked'
}

/**
 * Trust framework configuration
 * Root structure of trusted-issuers.json
 */
export interface TrustFrameworkConfig {
  /**
   * Framework version
   */
  version: string;

  /**
   * Last update timestamp (ISO 8601)
   */
  lastUpdated: string;

  /**
   * Array of trusted issuers
   */
  trustedIssuers: TrustedIssuer[];
}
