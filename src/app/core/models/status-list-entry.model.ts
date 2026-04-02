/**
 * Represents a credential status entry.
 * 
 * Used for revocation checking via Bitstring Status List.
 * Cached in IndexedDB to reduce HTTP requests.
 * 
 * @interface StatusListEntry
 */
export interface StatusListEntry {
  /**
   * Status list URL (from credentialStatus.statusListCredential)
   */
  statusListUrl: string;

  /**
   * Credential index in the status list
   */
  credentialIndex: number;

  /**
   * Revocation status
   * true = credential is revoked
   * false = credential is active
   */
  isRevoked: boolean;

  /**
   * Last check timestamp (ISO 8601)
   */
  lastCheckedAt: string;

  /**
   * Cache TTL in seconds
   * After this period, status should be re-checked
   */
  cacheTtlSeconds: number;
}

/**
 * Bitstring Status List Credential structure
 * Decoded from status list JWT
 */
export interface StatusListCredential {
  /**
   * JWT standard claims
   */
  iss: string;       // Issuer
  iat: number;       // Issued at
  exp?: number;      // Expiration

  /**
   * VC claims
   */
  vc: {
    '@context': string[];
    type: string[];
    credentialSubject: StatusListCredentialSubject;
  };
}

/**
 * Status list credential subject
 * Contains the encoded bitstring
 */
export interface StatusListCredentialSubject {
  id: string;
  type: string;  // "BitstringStatusList"
  statusPurpose: string;  // "revocation"
  encodedList: string;  // Base64-encoded compressed bitstring
}

/**
 * Status check result
 */
export interface StatusCheckResult {
  /**
   * Is the credential revoked?
   */
  isRevoked: boolean;

  /**
   * Status list URL checked
   */
  statusListUrl: string;

  /**
   * Credential index checked
   */
  credentialIndex: number;

  /**
   * Check timestamp (ISO 8601)
   */
  checkedAt: string;

  /**
   * Was result from cache?
   */
  fromCache: boolean;

  /**
   * Error message if check failed
   */
  error?: string;
}
