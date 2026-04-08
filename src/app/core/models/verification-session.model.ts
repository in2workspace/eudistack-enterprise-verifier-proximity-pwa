/**
 * Represents an ephemeral verification session.
 * 
 * Generated when a QR code is displayed to the user.
 * Contains cryptographic keypair and request metadata.
 * Session expires after timeout (default: 120s).
 * 
 * @interface VerificationSession
 */
export interface VerificationSession {
  /**
   * Unique session identifier (UUID v4)
   */
  sessionId: string;

  /**
   * Verifier client_id (DID:key)
   * Used in OID4VP authorization request
   */
  clientId: string;

  /**
   * Ephemeral keypair for signing authorization request
   * Generated using Web Crypto API (ES256)
   */
  keypair: CryptoKeyPair;

  /**
   * Random nonce for replay attack prevention (Base64URL)
   * Must match the nonce in the VP token
   */
  nonce: string;

  /**
   * JWT authorization request object (JAR)
   * Signed with session keypair
   */
  requestObject: string;

  /**
   * Session creation timestamp (ISO 8601)
   */
  createdAt: string;

  /**
   * Session expiration timestamp (ISO 8601)
   * Default: createdAt + 120 seconds
   */
  expiresAt: string;

  /**
   * Session state
   */
  status: SessionStatus;
}

/**
 * Session lifecycle states
 */
export enum SessionStatus {
  /** Session created, waiting for presentation */
  ACTIVE = 'active',
  
  /** VP received, validation in progress */
  VALIDATING = 'validating',
  
  /** Validation completed successfully */
  COMPLETED = 'completed',
  
  /** Session expired (timeout reached) */
  EXPIRED = 'expired',
  
  /** Validation failed */
  FAILED = 'failed'
}
