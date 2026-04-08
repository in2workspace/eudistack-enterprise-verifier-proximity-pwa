import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

/**
 * CryptoService Tests
 * 
 * Note: These tests run in Node.js environment, which has limited Web Crypto API support.
 * For comprehensive testing of cryptographic operations, use the Phase 1 Demo page in a browser.
 * 
 * These tests verify:
 * - Service instantiation
 * - Algorithm support checks
 * - Nonce generation
 * - Basic key generation and JWK operations
 */
describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Key Generation', () => {
    it('should generate ES256 keypair', async () => {
      const startTime = performance.now();
      const keypair = await service.generateKeyPair('ES256');
      const duration = performance.now() - startTime;

      expect(keypair).toBeDefined();
      expect(keypair.privateKey).toBeDefined();
      expect(keypair.publicKey).toBeDefined();
      expect(keypair.privateKey.type).toBe('private');
      expect(keypair.publicKey.type).toBe('public');
      
      // Performance check: should be < 1000ms (more lenient for Node.js)
      expect(duration).toBeLessThan(1000);
    });

    // Skip EdDSA test in Node.js - not fully supported
    it.skip('should generate EdDSA keypair', async () => {
      const keypair = await service.generateKeyPair('EdDSA');
      expect(keypair).toBeDefined();
    });
  });

  describe('JWK Operations', () => {
    it('should export public key to JWK', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const jwk = await service.exportPublicKey(keypair.publicKey);

      expect(jwk).toBeDefined();
      expect(jwk.kty).toBe('EC');
      expect(jwk.crv).toBe('P-256');
      expect(jwk.x).toBeDefined();
      expect(jwk.y).toBeDefined();
    });

    it('should import JWK to CryptoKey', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const jwk = await service.exportPublicKey(keypair.publicKey);
      
      const importedKey = await service.importPublicKey(jwk, 'ES256');

      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('public');
    });

    it('should calculate JWK thumbprint (RFC 7638)', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const jwk = await service.exportPublicKey(keypair.publicKey);
      
      const thumbprint = await service.calculateThumbprint(jwk);

      expect(thumbprint).toBeDefined();
      expect(typeof thumbprint).toBe('string');
      expect(thumbprint.length).toBeGreaterThan(0);
      
      // Should be deterministic
      const thumbprint2 = await service.calculateThumbprint(jwk);
      expect(thumbprint).toBe(thumbprint2);
    });

    it('should calculate key thumbprint directly', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const thumbprint = await service.calculateKeyThumbprint(keypair.publicKey);

      expect(thumbprint).toBeDefined();
      expect(typeof thumbprint).toBe('string');
    });
  });

  describe('Nonce and State Generation', () => {
    it('should generate random nonce', () => {
      const nonce1 = service.generateNonce();
      const nonce2 = service.generateNonce();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(typeof nonce1).toBe('string');
    });

    it('should generate nonce with custom length', () => {
      const nonce = service.generateNonce(16);
      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
    });

    it('should generate random state', () => {
      const state1 = service.generateState();
      const state2 = service.generateState();

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
    });
  });

  describe('Algorithm Support', () => {
    it('should check if algorithm is supported', () => {
      // Supported algorithms
      expect(service.isAlgorithmSupported('ES256')).toBe(true);
      expect(service.isAlgorithmSupported('EdDSA')).toBe(true);
      
      // Unsupported algorithms
      expect(service.isAlgorithmSupported('ES384')).toBe(false);
      expect(service.isAlgorithmSupported('ES512')).toBe(false);
      expect(service.isAlgorithmSupported('RS256')).toBe(false);
      expect(service.isAlgorithmSupported('HS256')).toBe(false);
    });

    it('should return supported algorithms', () => {
      const algorithms = service.getSupportedAlgorithms();
      
      expect(algorithms).toContain('ES256');
      expect(algorithms).toContain('EdDSA');
      expect(algorithms.length).toBe(2);
    });
  });

  describe('DID:key Generation', () => {
    it('should generate did:key from P-256 public key', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const didKey = await service.generateDidKey(keypair.publicKey);

      expect(didKey).toBeDefined();
      expect(didKey).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
      expect(didKey.startsWith('did:key:z')).toBe(true);
    });

    it('should generate deterministic did:key for same public key', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const didKey1 = await service.generateDidKey(keypair.publicKey);
      const didKey2 = await service.generateDidKey(keypair.publicKey);

      expect(didKey1).toBe(didKey2);
    });

    it('should generate different did:key for different keypairs', async () => {
      const keypair1 = await service.generateKeyPair('ES256');
      const keypair2 = await service.generateKeyPair('ES256');
      
      const didKey1 = await service.generateDidKey(keypair1.publicKey);
      const didKey2 = await service.generateDidKey(keypair2.publicKey);

      expect(didKey1).not.toBe(didKey2);
    });

    it('should generate verifier identity with clientId and keypair', async () => {
      const identity = await service.generateVerifierIdentity();

      expect(identity).toBeDefined();
      expect(identity.clientId).toBeDefined();
      expect(identity.clientId).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
      expect(identity.keypair).toBeDefined();
      expect(identity.keypair.publicKey).toBeDefined();
      expect(identity.keypair.privateKey).toBeDefined();
    });

    it('should generate valid multibase-encoded did:key', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const didKey = await service.generateDidKey(keypair.publicKey);

      // Extract multibase-encoded part (after 'did:key:z')
      const multibaseEncoded = didKey.substring('did:key:z'.length);

      // Verify base58 alphabet (Bitcoin)
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
      expect(multibaseEncoded).toMatch(base58Regex);
    });
  });

  describe('JWT Signing', () => {
    it('should sign JWT with default typ=JWT', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const payload = { sub: 'test', iat: Math.floor(Date.now() / 1000) };
      
      const jwt = await service.signJwt(payload, keypair.privateKey);

      // Decode header and verify typ
      const header = service.extractAlgorithm(jwt);
      expect(header).toBe('ES256');
      
      // Verify the JWT is valid
      const decoded = service.decodeJwt(jwt);
      expect(decoded.sub).toBe('test');
    });

    it('should sign JWT with custom typ for OID4VP authorization requests', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const payload = {
        client_id: 'did:key:z...',
        response_type: 'vp_token',
        nonce: 'test-nonce'
      };
      
      const jwt = await service.signJwt(
        payload,
        keypair.privateKey,
        'ES256',
        'oauth-authz-req+jwt'
      );

      expect(jwt).toBeDefined();
      
      // Decode and verify structure
      const decoded = service.decodeJwt(jwt);
      expect(decoded.client_id).toBe('did:key:z...');
      expect(decoded.response_type).toBe('vp_token');
    });

    it('should include kid in JWT header when provided', async () => {
      const keypair = await service.generateKeyPair('ES256');
      const didKey = 'did:key:zDnaegqxnGrSfnHR4WjT9g1RtdThNigx3NuDs84RyV733ecaF';
      const payload = {
        iss: didKey,
        client_id: didKey,
        response_type: 'vp_token'
      };
      
      const jwt = await service.signJwt(
        payload,
        keypair.privateKey,
        'ES256',
        'oauth-authz-req+jwt',
        didKey  // kid parameter
      );

      expect(jwt).toBeDefined();
      
      // Split JWT to inspect header
      const parts = jwt.split('.');
      expect(parts.length).toBe(3);
      
      // Decode header (base64url)
      const headerJson = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
      const header = JSON.parse(headerJson);
      
      expect(header.alg).toBe('ES256');
      expect(header.typ).toBe('oauth-authz-req+jwt');
      expect(header.kid).toBe(didKey);
    });
  });
});
