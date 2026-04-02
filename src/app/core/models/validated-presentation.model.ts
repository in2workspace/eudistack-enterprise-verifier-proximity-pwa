import { ValidationResult } from './validation-result.model';

/**
 * Represents a validated Verifiable Presentation.
 * 
 * Contains the original VP token, extracted VCs,
 * and the validation result.
 * 
 * @interface ValidatedPresentation
 */
export interface ValidatedPresentation {
  /**
   * Session ID this presentation belongs to
   */
  sessionId: string;

  /**
   * Raw VP token (JWT)
   */
  vpToken: string;

  /**
   * Parsed VP payload
   */
  vp: VerifiablePresentation;

  /**
   * Extracted Verifiable Credentials
   */
  verifiableCredentials: VerifiableCredential[];

  /**
   * Validation result
   */
  validationResult: ValidationResult;

  /**
   * Submission timestamp (ISO 8601)
   */
  submittedAt: string;
}

/**
 * Verifiable Presentation structure (decoded JWT payload)
 */
export interface VerifiablePresentation {
  /**
   * JWT standard claims
   */
  iss: string;       // Issuer (holder DID)
  aud: string;       // Audience (verifier)
  iat: number;       // Issued at (Unix timestamp)
  exp?: number;      // Expiration (Unix timestamp)
  nbf?: number;      // Not before (Unix timestamp)
  jti?: string;      // JWT ID
  nonce: string;     // Nonce from authorization request

  /**
   * VP-specific claims
   */
  vp: {
    '@context': string[];
    type: string[];
    verifiableCredential: string[];  // Array of VC JWTs
  };
}

/**
 * Verifiable Credential structure (decoded JWT payload)
 */
export interface VerifiableCredential {
  /**
   * JWT standard claims
   */
  iss: string;       // Issuer DID
  sub: string;       // Subject (credential holder DID)
  iat: number;       // Issued at
  exp?: number;      // Expiration
  nbf?: number;      // Not before
  jti?: string;      // JWT ID

  /**
   * VC-specific claims
   */
  vc: {
    '@context': string[];
    type: string[];
    credentialSubject: CredentialSubject;
    credentialStatus?: CredentialStatus;
  };
}

/**
 * Credential subject claims
 * Contains actual user data
 */
export interface CredentialSubject {
  // Extensible for other credential types
  [key: string]: unknown;
  
  id: string;  // Subject DID
  
  // Identity claims (example for employee credential)
  first_name?: string;
  family_name?: string;
  birth_date?: string;
  email?: string;
  employee_id?: string;
  department?: string;
  role?: string;
}

/**
 * Credential status information
 * For revocation checking
 */
export interface CredentialStatus {
  id: string;
  type: string;  // e.g., "BitstringStatusListEntry"
  statusPurpose: string;  // e.g., "revocation"
  statusListIndex: string;
  statusListCredential: string;  // URL to status list
}
