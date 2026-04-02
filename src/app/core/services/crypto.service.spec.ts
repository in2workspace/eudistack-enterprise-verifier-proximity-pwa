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
      expect(service.isAlgorithmSupported('ES256')).toBe(true);
      expect(service.isAlgorithmSupported('EdDSA')).toBe(true);
      expect(service.isAlgorithmSupported('RS256')).toBe(false);
      expect(service.isAlgorithmSupported('HS256')).toBe(false);
    });

    it('should return supported algorithms', () => {
      const algorithms = service.getSupportedAlgorithms();
      
      expect(algorithms).toContain('ES256');
      expect(algorithms).toContain('EdDSA');
      expect(algorithms.length).toBeGreaterThan(0);
    });
  });
});
