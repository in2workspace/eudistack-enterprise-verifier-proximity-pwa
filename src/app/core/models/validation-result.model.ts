/**
 * Result of VP/VC validation process.
 * 
 * Contains boolean flags for each validation step
 * and detailed error messages if validation fails.
 * 
 * @interface ValidationResult
 */
export interface ValidationResult {
  /**
   * Overall validation status
   */
  isValid: boolean;

  /**
   * VP JWT signature is valid
   */
  vpValid: boolean;

  /**
   * VC JWT signature is valid
   */
  vcSignatureValid: boolean;

  /**
   * Issuer is in trusted framework
   */
  trustValid: boolean;

  /**
   * Credential not revoked (status list check)
   */
  statusValid: boolean;

  /**
   * Nonce matches authorization request
   */
  nonceValid: boolean;

  /**
   * Timestamps are valid (not expired)
   */
  timestampValid: boolean;

  /**
   * Identity fields match across VCs
   */
  identityMatchValid: boolean;

  /**
   * Array of validation errors
   * Empty if validation succeeds
   */
  errors: ValidationError[];

  /**
   * Validation timestamp (ISO 8601)
   */
  validatedAt: string;

  /**
   * Processing time in milliseconds
   */
  processingTimeMs: number;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /**
   * Error code (machine-readable)
   */
  code: ValidationErrorCode;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Field that caused the error (optional)
   */
  field?: string;

  /**
   * Additional error context (optional)
   */
  details?: Record<string, unknown>;
}

/**
 * Standardized validation error codes
 */
export enum ValidationErrorCode {
  // VP errors
  INVALID_VP_SIGNATURE = 'invalid_vp_signature',
  INVALID_VP_FORMAT = 'invalid_vp_format',
  INVALID_VP_STRUCTURE = 'invalid_vp_structure',
  INVALID_JWT_FORMAT = 'invalid_jwt_format',

  // VC errors
  INVALID_VC_SIGNATURE = 'invalid_vc_signature',
  INVALID_VC_FORMAT = 'invalid_vc_format',
  INVALID_VC_STRUCTURE = 'invalid_vc_structure',

  // Trust framework errors
  ISSUER_NOT_TRUSTED = 'issuer_not_trusted',
  ISSUER_NOT_RESOLVED = 'issuer_not_resolved',
  UNTRUSTED_ISSUER = 'untrusted_issuer',
  TRUST_CHECK_FAILED = 'trust_check_failed',
  DID_RESOLUTION_FAILED = 'did_resolution_failed',

  // Status errors
  CREDENTIAL_REVOKED = 'credential_revoked',
  STATUS_LIST_UNAVAILABLE = 'status_list_unavailable',

  // Nonce errors
  NONCE_MISMATCH = 'nonce_mismatch',
  NONCE_MISSING = 'nonce_missing',

  // Timestamp errors
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_NOT_YET_VALID = 'token_not_yet_valid',
  INVALID_TIMESTAMP = 'invalid_timestamp',

  // Identity errors
  IDENTITY_MISMATCH = 'identity_mismatch',
  REQUIRED_FIELD_MISSING = 'required_field_missing',

  // Generic errors
  UNSUPPORTED_ALGORITHM = 'unsupported_algorithm',
  CRYPTO_ERROR = 'crypto_error',
  UNKNOWN_ERROR = 'unknown_error'
}
