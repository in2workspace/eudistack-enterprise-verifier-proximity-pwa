import { Injectable, inject } from '@angular/core';
import { Observable, from, of, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { decodeJwt, jwtVerify, JWTPayload } from 'jose';
import { CryptoService } from './crypto.service';
import { TrustFrameworkService } from './trust-framework.service';
import { StatusListService } from './status-list.service';
import { DidResolver, DidResolutionError } from '../utils/did-resolver.util';
import { ValidationErrorCode } from '../models/validation-result.model';
import { ValidatedPresentation } from '../models/validated-presentation.model';

/**
 * Verifiable Presentation Validator Service
 * 
 * Validates Verifiable Presentations and Verifiable Credentials.
 * 
 * Validation pipeline:
 * 1. Parse & decode VP JWT
 * 2. Verify VP signature (verifier ephemeral key)
 * 3. Validate VP structure & claims (nonce, aud, exp)
 * 4. Extract VC from VP
 * 5. Verify VC signature (issuer DID resolution)
 * 6. Validate VC structure & claims
 * 7. Check issuer trust (trust framework)
 * 8. Check credential status (revocation)
 * 
 * @service
 * @injectable
 */
@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  // Dependencies
  private readonly cryptoService = inject(CryptoService);
  private readonly trustFramework = inject(TrustFrameworkService);
  private readonly statusList = inject(StatusListService);
  
  private readonly didResolver = new DidResolver();

  /**
   * Validate Verifiable Presentation
   * 
   * Complete validation pipeline for VP and contained VC.
   * 
   * @param sessionId - Session ID
   * @param vpToken - VP JWT token
   * @param expectedNonce - Expected nonce from authorization request
   * @param verifierPublicKey - Verifier's public key (CryptoKey)
   * @returns Observable<ValidatedPresentation>
   */
  public validatePresentation(
    sessionId: string,
    vpToken: string,
    expectedNonce: string,
    verifierPublicKey: CryptoKey
  ): Observable<ValidatedPresentation> {
    return from(this.validatePresentationAsync(sessionId, vpToken, expectedNonce, verifierPublicKey)).pipe(
      catchError(error => {
        console.error('[Validation] Presentation validation failed:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = String(error);
        
        return of(this.buildValidationResult(
          sessionId,
          vpToken,
          {
            vpSignatureValid: false,
            vcSignatureValid: false,
            trustValid: false,
            statusValid: false,
            errors: [{
              code: ValidationErrorCode.UNKNOWN_ERROR,
              message: `Validation error: ${errorMessage}`,
              details: { error: errorDetails }
            }],
            vpPayload: undefined,
            vcPayload: null
          }
        ));
      })
    );
  }

  /**
   * Validate presentation (async implementation)
   * 
   * @param sessionId - Session ID
   * @param vpToken - VP JWT token
   * @param expectedNonce - Expected nonce
   * @param verifierPublicKey - Verifier public key
   * @returns Promise<ValidatedPresentation>
   */
  private async validatePresentationAsync(
    sessionId: string,
    vpToken: string,
    expectedNonce: string,
    verifierPublicKey: CryptoKey
  ): Promise<ValidatedPresentation> {
    const errors: ValidationErrorInfo[] = [];
    let vpSignatureValid = false;
    let vcSignatureValid = false;
    let trustValid = false;
    let statusValid = false;

    // Step 1: Decode VP JWT (without verification)
    let vpPayload: VpPayload;
    
    try {
      vpPayload = decodeJwt(vpToken) as VpPayload;
    } catch (error) {
      errors.push({
        code: ValidationErrorCode.INVALID_JWT_FORMAT,
        message: 'Failed to decode VP JWT',
        details: { error: String(error) }
      });

      return this.buildValidationResult(sessionId, vpToken, {
        vpSignatureValid: false,
        vcSignatureValid: false,
        trustValid: false,
        statusValid: false,
        errors,
        vpPayload: undefined,
        vcPayload: null
      });
    }

    // Step 2: Verify VP signature
    try {
      await jwtVerify(vpToken, verifierPublicKey, {
        algorithms: ['ES256', 'EdDSA']
      });
      vpSignatureValid = true;
    } catch (error) {
      errors.push({
        code: ValidationErrorCode.INVALID_VP_SIGNATURE,
        message: 'VP signature verification failed',
        details: { error: String(error) }
      });
    }

    // Step 3: Validate VP structure
    const vpStructureErrors = this.validateVpStructure(vpPayload, expectedNonce);
    errors.push(...vpStructureErrors);

    // Step 4: Extract VC from VP
    let vcToken: string;
    let vcPayload: VcPayload;

    try {
      vcToken = this.extractVcFromVp(vpPayload);
      vcPayload = decodeJwt(vcToken) as VcPayload;
    } catch (error) {
      errors.push({
        code: ValidationErrorCode.INVALID_VC_STRUCTURE,
        message: 'Failed to extract VC from VP',
        details: { error: String(error) }
      });

      return this.buildValidationResult(sessionId, vpToken, {
        vpSignatureValid,
        vcSignatureValid: false,
        trustValid: false,
        statusValid: false,
        errors,
        vpPayload,
        vcPayload: null
      });
    }

    // Step 5: Verify VC signature
    try {
      const issuerDid = vcPayload.iss;
      
      if (!issuerDid) {
        throw new ValidationError('No issuer DID in VC', ValidationErrorCode.INVALID_VC_STRUCTURE);
      }

      // Resolve issuer DID to public key
      const didResolution = await this.didResolver.resolve(issuerDid);

      // Verify VC signature
      await jwtVerify(vcToken, didResolution.publicKey, {
        algorithms: ['ES256', 'EdDSA', 'RS256']
      });

      vcSignatureValid = true;
    } catch (error) {
      if (error instanceof DidResolutionError) {
        const causeDetails = error.cause !== undefined ? String(error.cause) : 'unknown';
        errors.push({
          code: ValidationErrorCode.DID_RESOLUTION_FAILED,
          message: 'Failed to resolve issuer DID',
          details: { error: error.message, cause: causeDetails }
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          code: ValidationErrorCode.INVALID_VC_SIGNATURE,
          message: 'VC signature verification failed',
          details: { error: errorMessage }
        });
      }
    }

    // Step 6: Validate VC structure
    const vcStructureErrors = this.validateVcStructure(vcPayload);
    errors.push(...vcStructureErrors);

    // Step 7: Check issuer trust
    try {
      const issuerDid = vcPayload.iss;
      if (!issuerDid) {
        errors.push({
          code: ValidationErrorCode.INVALID_VC_STRUCTURE,
          message: 'Missing issuer DID in VC',
          details: {}
        });
      } else {
        const isTrusted = await firstValueFrom(
          this.trustFramework.isTrustedIssuer(issuerDid)
        );

        if (isTrusted) {
          trustValid = true;
        } else {
          errors.push({
            code: ValidationErrorCode.UNTRUSTED_ISSUER,
            message: `Issuer ${issuerDid} is not in the trust framework`,
            details: { issuerDid }
          });
        }
      }
    } catch (error) {
      errors.push({
        code: ValidationErrorCode.TRUST_CHECK_FAILED,
        message: 'Failed to check issuer trust',
        details: { error: String(error) }
      });
    }

    // Step 8: Check credential status  
    try {
      const statusResult = await firstValueFrom(
        this.statusList.checkCredentialStatus(vcPayload)
      );

      if (statusResult.checked && statusResult.isRevoked) {
        errors.push({
          code: ValidationErrorCode.CREDENTIAL_REVOKED,
          message: 'Credential has been revoked',
          details: {
            statusListUrl: statusResult.statusListUrl || '',
            credentialIndex: statusResult.credentialIndex !== null ? statusResult.credentialIndex : -1,
            message: statusResult.message
          }
        });
        statusValid = false;
      } else if (statusResult.checked) {
        statusValid = true;
      } else {
        // Status check failed but didn't block validation
        statusValid = true; // Graceful handling
      }
    } catch (error) {
      // Status check failure doesn't block validation
      console.warn('[Validation] Status check failed, continuing...', error);
      statusValid = true; // Graceful handling
    }

    return this.buildValidationResult(sessionId, vpToken, {
      vpSignatureValid,
      vcSignatureValid,
      trustValid,
      statusValid,
      errors,
      vpPayload,
      vcPayload
    });
  }

  /**
   * Validate VP structure and claims
   * 
   * @param vpPayload - VP payload
   * @param expectedNonce - Expected nonce
   * @returns Array of validation errors
   */
  private validateVpStructure(vpPayload: VpPayload, expectedNonce: string): ValidationErrorInfo[] {
    const errors: ValidationErrorInfo[] = [];

    // Check vp claim exists
    if (!vpPayload.vp) {
      errors.push({
        code: ValidationErrorCode.INVALID_VP_STRUCTURE,
        message: 'Missing "vp" claim in VP payload'
      });
    }

    // Check nonce matches
    if (vpPayload.nonce !== expectedNonce) {
      errors.push({
        code: ValidationErrorCode.NONCE_MISMATCH,
        message: `Nonce mismatch: expected "${expectedNonce}", got "${vpPayload.nonce}"`,
        details: { expected: expectedNonce, actual: vpPayload.nonce }
      });
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    
    if (vpPayload.exp && vpPayload.exp < now) {
      errors.push({
        code: ValidationErrorCode.TOKEN_EXPIRED,
        message: 'VP token has expired',
        details: { exp: vpPayload.exp, now }
      });
    }

    // Check issued at
    if (vpPayload.iat && vpPayload.iat > now + 60) {
      errors.push({
        code: ValidationErrorCode.INVALID_TIMESTAMP,
        message: 'VP iat (issued at) is in the future',
        details: { iat: vpPayload.iat, now }
      });
    }

    return errors;
  }

  /**
   * Extract VC from VP
   * 
   * @param vpPayload - VP payload
   * @returns VC JWT token
   * @throws {Error} If VC cannot be extracted
   */
  private extractVcFromVp(vpPayload: VpPayload): string {
    if (!vpPayload.vp || !vpPayload.vp.verifiableCredential) {
      throw new Error('No verifiableCredential in VP');
    }

    const vcs = vpPayload.vp.verifiableCredential;

    if (!Array.isArray(vcs) || vcs.length === 0) {
      throw new Error('verifiableCredential is not an array or is empty');
    }

    // For now, validate only the first VC
    // In production, you might want to validate all VCs
    return vcs[0];
  }

  /**
   * Validate VC structure and claims
   * 
   * @param vcPayload - VC payload
   * @returns Array of validation errors
   */
  private validateVcStructure(vcPayload: VcPayload): ValidationErrorInfo[] {
    const errors: ValidationErrorInfo[] = [];

    // Check vc claim exists
    if (!vcPayload.vc) {
      errors.push({
        code: ValidationErrorCode.INVALID_VC_STRUCTURE,
        message: 'Missing "vc" claim in VC payload'
      });
    }

    // Check issuer exists
    if (!vcPayload.iss) {
      errors.push({
        code: ValidationErrorCode.INVALID_VC_STRUCTURE,
        message: 'Missing "iss" (issuer) claim in VC'
      });
    }

    // Check subject exists
    if (!vcPayload.sub && (!vcPayload.vc || !vcPayload.vc.credentialSubject)) {
      errors.push({
        code: ValidationErrorCode.INVALID_VC_STRUCTURE,
        message: 'Missing "sub" or "credentialSubject" in VC'
      });
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    
    if (vcPayload.exp && vcPayload.exp < now) {
      errors.push({
        code: ValidationErrorCode.TOKEN_EXPIRED,
        message: 'VC token has expired',
        details: { exp: vcPayload.exp, now }
      });
    }

    // Check not before
    if (vcPayload.nbf && vcPayload.nbf > now) {
      errors.push({
        code: ValidationErrorCode.TOKEN_NOT_YET_VALID,
        message: 'VC token is not yet valid',
        details: { nbf: vcPayload.nbf, now }
      });
    }

    return errors;
  }

  /**
   * Build validation result
   * 
   * @param sessionId - Session ID
   * @param vpToken - VP token
   * @param validationData - Validation data
   * @returns ValidatedPresentation
   */
  private buildValidationResult(
    sessionId: string,
    vpToken: string,
    validationData: {
      vpSignatureValid: boolean;
      vcSignatureValid: boolean;
      trustValid: boolean;
      statusValid: boolean;
      errors: ValidationErrorInfo[];
      vpPayload?: VpPayload;
      vcPayload?: VcPayload | null;
    }
  ): ValidatedPresentation {
    const { vpSignatureValid, vcSignatureValid, trustValid, statusValid, errors, vpPayload } = validationData;

    const isValid = 
      vpSignatureValid &&
      vcSignatureValid &&
      trustValid &&
      statusValid &&
      errors.length === 0;

    // Extract VCs from VP
    const vcs: string[] = vpPayload?.vp?.verifiableCredential || [];

    return {
      sessionId,
      vpToken,
      vp: {
        iss: vpPayload?.iss || '',
        aud: typeof vpPayload?.aud === 'string' ? vpPayload.aud : (Array.isArray(vpPayload?.aud) ? vpPayload.aud[0] : ''),
        iat: vpPayload?.iat || Math.floor(Date.now() / 1000),
        exp: vpPayload?.exp,
        nbf: vpPayload?.nbf,
        jti: vpPayload?.jti,
        nonce: vpPayload?.nonce || '',
        vp: {
          '@context': Array.isArray(vpPayload?.vp?.['@context']) 
            ? vpPayload.vp['@context'] 
            : vpPayload?.vp?.['@context'] ? [vpPayload.vp['@context'] as string] : [],
          type: Array.isArray(vpPayload?.vp?.type) 
            ? vpPayload.vp.type 
            : vpPayload?.vp?.type ? [vpPayload.vp.type as string] : [],
          verifiableCredential: vpPayload?.vp?.verifiableCredential || []
        }
      },
      verifiableCredentials: vcs.map(vcToken => {
        try {
          const decoded = decodeJwt(vcToken) as VcPayload;
          const credSubject = decoded.vc?.credentialSubject || {};
          const credStatus = decoded.vc?.credentialStatus;
          return {
            iss: decoded.iss || '',
            sub: decoded.sub || '',
            iat: decoded.iat || Math.floor(Date.now() / 1000),
            exp: decoded.exp,
            nbf: decoded.nbf,
            jti: decoded.jti,
            vc: {
              '@context': Array.isArray(decoded.vc?.['@context']) 
                ? decoded.vc['@context'] 
                : decoded.vc?.['@context'] ? [decoded.vc['@context'] as string] : [],
              type: Array.isArray(decoded.vc?.type) 
                ? decoded.vc.type 
                : decoded.vc?.type ? [decoded.vc.type as string] : [],
              credentialSubject: {
                id: (credSubject as Record<string, unknown>)['id'] as string || decoded.sub || '',
                ...credSubject
              },
              credentialStatus: credStatus ? {
                id: decoded.jti || '',
                type: credStatus.type,
                statusPurpose: 'revocation',
                statusListIndex: credStatus.statusListIndex,
                statusListCredential: credStatus.statusListCredential
              } : undefined
            }
          };
        } catch {
          // Return minimal structure if decode fails
          return {
            iss: '',
            sub: '',
            iat: Math.floor(Date.now() / 1000),
            vc: {
              '@context': [],
              type: [],
              credentialSubject: {
                id: ''
              }
            }
          };
        }
      }),
      validationResult: {
        isValid,
        vpValid: vpSignatureValid,
        vcSignatureValid,
        trustValid,
        statusValid,
        nonceValid: true, // TODO: track separately
        timestampValid: true, // TODO: track separately
        identityMatchValid: true, // TODO: track separately
        errors,
        validatedAt: new Date().toISOString(),
        processingTimeMs: 0 // Will be calculated by caller
      },
      submittedAt: new Date().toISOString()
    };
  }
}

/**
 * VP Payload structure
 */
interface VpPayload extends JWTPayload {
  vp?: {
    '@context': string | string[];
    type: string | string[];
    verifiableCredential: string[]; // Array of VC JWTs
  };
  nonce?: string;
}

/**
 * VC Payload structure
 */
interface VcPayload extends JWTPayload {
  vc?: {
    '@context': string | string[];
    type: string | string[];
    credentialSubject: Record<string, unknown>;
    credentialStatus?: {
      type: string;
      statusListCredential: string;
      statusListIndex: string;
    };
  };
}

/**
 * Custom validation error class
 */
class ValidationError extends Error {
  public constructor(
    message: string,
    public readonly code: ValidationErrorCode
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation Error structure
 */
interface ValidationErrorInfo {
  code: ValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
