import { Injectable } from '@angular/core';
import * as jose from 'jose';

/**
 * Crypto Service
 * 
 * Wrapper for Web Crypto API providing cryptographic operations.
 * Supports ES256, EdDSA, and ECDSA algorithms.
 * 
 * Key operations:
 * - Generate ephemeral keypairs
 * - Sign JWTs (JWS)
 * - Verify JWT signatures
 * - Export public keys to JWK
 * - Calculate JWK thumbprints (RFC 7638)
 * 
 * @service
 */
@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  // Supported algorithms
  private readonly SUPPORTED_ALGORITHMS = ['ES256', 'EdDSA', 'ES384', 'ES512'] as const;
  
  // Default algorithm
  private readonly DEFAULT_ALGORITHM = 'ES256';

  /**
   * Generate an ephemeral ES256 keypair
   * 
   * @returns CryptoKeyPair for signing operations
   * @throws CryptoException if generation fails
   */
  public async generateKeyPair(
    algorithm: 'ES256' | 'EdDSA' = 'ES256'
  ): Promise<CryptoKeyPair> {
    try {
      const startTime = performance.now();

      let keypair: CryptoKeyPair;

      if (algorithm === 'ES256') {
        keypair = await crypto.subtle.generateKey(
          {
            name: 'ECDSA',
            namedCurve: 'P-256'
          },
          true,  // extractable
          ['sign', 'verify']
        );
      } else if (algorithm === 'EdDSA') {
        // EdDSA using Ed25519
        const key = await crypto.subtle.generateKey(
          {
            name: 'Ed25519'
          } as AlgorithmIdentifier, // Type workaround for Ed25519
          true,
          ['sign', 'verify']
        );
        keypair = key as CryptoKeyPair; // Ed25519 returns CryptoKeyPair
      } else {
        throw new CryptoException(`Unsupported algorithm: ${algorithm}`);
      }

      const duration = performance.now() - startTime;
      
      if (duration > 500) {
        console.warn(`Keypair generation took ${duration.toFixed(2)}ms`);
      }

      return keypair;
    } catch (error) {
      throw new CryptoException('Failed to generate keypair', error);
    }
  }

  /**
   * Sign a JWT payload with a private key
   * 
   * @param payload JWT payload object
   * @param privateKey Private key for signing
   * @param algorithm Signing algorithm (default: ES256)
   * @returns Signed JWT string (JWS)
   * @throws CryptoException if signing fails
   */
  public async signJwt(
    payload: Record<string, unknown>,
    privateKey: CryptoKey,
    algorithm: 'ES256' | 'EdDSA' = 'ES256'
  ): Promise<string> {
    try {
      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: algorithm, typ: 'JWT' })
        .setIssuedAt()
        .sign(privateKey);

      return jwt;
    } catch (error) {
      throw new CryptoException('Failed to sign JWT', error);
    }
  }

  /**
   * Verify a JWT signature
   * 
   * @param jws JSON Web Signature (JWT string)
   * @param publicKey Public key for verification
   * @returns True if signature is valid
   * @throws CryptoException if verification fails
   */
  public async verifySignature(
    jws: string,
    publicKey: CryptoKey
  ): Promise<boolean> {
    try {
      const result = await jose.jwtVerify(jws, publicKey);
      return !!result.payload;
    } catch (error) {
      // Invalid signature or malformed JWT
      console.warn('JWT verification failed:', error);
      return false;
    }
  }

  /**
   * Verify JWT and return decoded payload
   * 
   * @param jws JSON Web Signature (JWT string)
   * @param publicKey Public key for verification
   * @returns Decoded payload if valid, null otherwise
   */
  public async verifyAndDecode<T = jose.JWTPayload>(
    jws: string,
    publicKey: CryptoKey
  ): Promise<T | null> {
    try {
      const result = await jose.jwtVerify(jws, publicKey);
      return result.payload as T;
    } catch (error) {
      console.warn('JWT verification/decode failed:', error);
      return null;
    }
  }

  /**
   * Decode JWT without verification (UNSAFE - for inspection only)
   * 
   * @param jwt JWT string
   * @returns Decoded payload
   * @throws CryptoException if decode fails
   */
  public decodeJwt<T = jose.JWTPayload>(jwt: string): T {
    try {
      const decoded = jose.decodeJwt(jwt);
      return decoded as T;
    } catch (error) {
      throw new CryptoException('Failed to decode JWT', error);
    }
  }

  /**
   * Export public key to JWK format
   * 
   * @param publicKey Public CryptoKey
   * @returns JWK object
   * @throws CryptoException if export fails
   */
  public async exportPublicKey(publicKey: CryptoKey): Promise<jose.JWK> {
    try {
      const jwk = await jose.exportJWK(publicKey);
      return jwk;
    } catch (error) {
      throw new CryptoException('Failed to export public key', error);
    }
  }

  /**
   * Import JWK to CryptoKey
   * 
   * @param jwk JSON Web Key
   * @param algorithm Algorithm (default: ES256)
   * @returns CryptoKey
   * @throws CryptoException if import fails
   */
  public async importPublicKey(
    jwk: jose.JWK,
    algorithm: string = this.DEFAULT_ALGORITHM
  ): Promise<CryptoKey> {
    try {
      const key = await jose.importJWK(jwk, algorithm);
      return key as CryptoKey;
    } catch (error) {
      throw new CryptoException('Failed to import public key', error);
    }
  }

  /**
   * Calculate JWK thumbprint (RFC 7638)
   * 
   * SHA-256 hash of canonical JSON representation
   * 
   * @param jwk JSON Web Key
   * @returns Base64URL-encoded thumbprint
   * @throws CryptoException if calculation fails
   */
  public async calculateThumbprint(jwk: jose.JWK): Promise<string> {
    try {
      const thumbprint = await jose.calculateJwkThumbprint(jwk, 'sha256');
      return thumbprint;
    } catch (error) {
      throw new CryptoException('Failed to calculate thumbprint', error);
    }
  }

  /**
   * Calculate thumbprint from public key
   * 
   * @param publicKey Public CryptoKey
   * @returns Base64URL-encoded thumbprint
   */
  public async calculateKeyThumbprint(publicKey: CryptoKey): Promise<string> {
    try {
      const jwk = await this.exportPublicKey(publicKey);
      return this.calculateThumbprint(jwk);
    } catch (error) {
      throw new CryptoException('Failed to calculate key thumbprint', error);
    }
  }

  /**
   * Generate a random nonce
   * 
   * @param length Byte length (default: 32)
   * @returns Base64URL-encoded random string
   */
  public generateNonce(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate a random state parameter
   * 
   * @returns Base64URL-encoded random string
   */
  public generateState(): string {
    return this.generateNonce(32);
  }

  /**
   * Check if an algorithm is supported
   * 
   * @param algorithm Algorithm name
   * @returns True if supported
   */
  public isAlgorithmSupported(algorithm: string): boolean {
    return this.SUPPORTED_ALGORITHMS.includes(algorithm as typeof this.SUPPORTED_ALGORITHMS[number]);
  }

  /**
   * Get supported algorithms
   * 
   * @returns Array of supported algorithm names
   */
  public getSupportedAlgorithms(): readonly string[] {
    return this.SUPPORTED_ALGORITHMS;
  }

  /**
   * Verify JWT header algorithm matches expected
   * 
   * @param jwt JWT string
   * @param expectedAlg Expected algorithm
   * @returns True if algorithm matches
   */
  public verifyAlgorithm(jwt: string, expectedAlg: string): boolean {
    try {
      const header = jose.decodeProtectedHeader(jwt);
      return header.alg === expectedAlg;
    } catch {
      return false;
    }
  }

  /**
   * Extract algorithm from JWT header
   * 
   * @param jwt JWT string
   * @returns Algorithm string or null if not found
   */
  public extractAlgorithm(jwt: string): string | null {
    try {
      const header = jose.decodeProtectedHeader(jwt);
      return header.alg ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Base64URL encode a Uint8Array
   * 
   * @param data Uint8Array to encode
   * @returns Base64URL-encoded string
   */
  private base64UrlEncode(data: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...data));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

/**
 * Crypto exception class
 * 
 * Thrown when cryptographic operations fail
 */
export class CryptoException extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CryptoException';
    
    // Log detailed error in development
    if (cause) {
      console.error('CryptoException cause:', cause);
    }
  }
}

/**
 * JWT Verification Options
 */
export interface JwtVerifyOptions {
  algorithms?: string[];
  audience?: string | string[];
  issuer?: string | string[];
  clockTolerance?: number;
  maxTokenAge?: number;
}
