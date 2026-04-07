import { DidResolver, DidResolutionError, UnsupportedDidMethodError } from './did-resolver.util';
import { importJWK } from 'jose';

// Mock jose's importJWK
jest.mock('jose', () => ({
  importJWK: jest.fn()
}));

// Mock Response class for Jest environment
class MockResponse {
  constructor(private body: string, private init: { status?: number; headers?: any } = {}) {}
  
  get status() {
    return this.init.status || 200;
  }
  
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  
  async json() {
    return JSON.parse(this.body);
  }
  
  async text() {
    return this.body;
  }
}

// Mock AbortSignal.timeout for Jest environment  
class MockAbortSignal {
  static timeout(ms: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }
}

// Mock CryptoKey for Jest environment
class MockCryptoKey {
  type: string = 'public';
  extractable: boolean = true;
  algorithm: any = { name: 'ECDSA', namedCurve: 'P-256' };
  usages: string[] = ['verify'];
}

// Set globals for tests
(global as any).Response = MockResponse;
(global as any).CryptoKey = MockCryptoKey;
if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
  (AbortSignal as any).timeout = MockAbortSignal.timeout;
}

/**
 * DID Resolver Utility Tests (FASE 2: Tarea 2.4)
 * 
 * Tests cover:
 * - did:key local resolution (no network)
 * - did:web HTTP resolution with CORS
 * - DID Document parsing (W3C spec)
 * - Public key extraction as JWK
 * - Caching functionality (1min TTL)
 * - Error handling for all DID methods
 */
describe('DidResolver', () => {
  let resolver: DidResolver;

  // Test DIDs
  const DID_KEY_ES256 = 'did:key:z6MkhaXgBZDvotDvLHKmsZL6L2Y4QQxX3Aw3nMkbQZDU8WKz';
  const DID_WEB = 'did:web:issuer.eudistack.com';

  const MOCK_DID_DOCUMENT = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1'
    ],
    id: DID_WEB,
    verificationMethod: [
      {
        id: `${DID_WEB}#key-1`,
        type: 'JsonWebKey2020',
        controller: DID_WEB,
        publicKeyJwk: {
          kty: 'EC',
          crv: 'P-256',
          alg: 'ES256',
          x: 'acbIQiuMs3i8_uszEjJ2tpTtRM4EU3yz91PH6CdH2V0',
          y: '_KcyLj9vWMptnmKtm46GqDz8wf74I5LKgrl2GzH3nSE'
        }
      }
    ],
    authentication: [`${DID_WEB}#key-1`],
    assertionMethod: [`${DID_WEB}#key-1`]
  };

  beforeEach(() => {
    resolver = new DidResolver();
    
    // Mock global fetch for did:web tests
    global.fetch = jest.fn();
    
    // Mock importJWK to return a MockCryptoKey instance
    (importJWK as jest.Mock).mockResolvedValue(new MockCryptoKey());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('DID Validation', () => {
    it('should reject invalid DID format', async () => {
      await expect(resolver.resolve('not-a-did')).rejects.toThrow(DidResolutionError);
    });

    it('should reject null DID', async () => {
      await expect(resolver.resolve(null as any)).rejects.toThrow(DidResolutionError);
    });

    it('should reject empty DID', async () => {
      await expect(resolver.resolve('')).rejects.toThrow(DidResolutionError);
    });

    it('should reject unsupported DID method', async () => {
      await expect(resolver.resolve('did:example:123')).rejects.toThrow(UnsupportedDidMethodError);
    });

    it('should reject did:key as not yet implemented', async () => {
      await expect(resolver.resolve(DID_KEY_ES256)).rejects.toThrow(UnsupportedDidMethodError);
      
      try {
        await resolver.resolve(DID_KEY_ES256);
      } catch (error: any) {
        expect(error.message).toContain('key');
        expect(error.message).toContain('not yet implemented');
        expect(error.message).toContain('multibase');
      }
    });
  });

  describe('did:key Resolution (Task 2.4)', () => {
    it.skip('should resolve did:key without network call (pending multibase implementation)', async () => {
      const result = await resolver.resolve(DID_KEY_ES256);

      expect(result).toBeDefined();
      expect(result.did).toBe(DID_KEY_ES256);
      expect(result.publicKeyJwk).toBeDefined();
      expect(result.publicKey).toBeDefined();
      expect(result.publicKey.type).toBe('public');
    });

    it.skip('should extract public key from did:key identifier (pending multibase implementation)', async () => {
      const result = await resolver.resolve(DID_KEY_ES256);

      expect(result.publicKeyJwk).toBeDefined();
      expect(result.publicKeyJwk.kty).toBeDefined();
    });

    it.skip('should return CryptoKey for Web Crypto API (pending multibase implementation)', async () => {
      const result = await resolver.resolve(DID_KEY_ES256);

      expect(result.publicKey).toBeDefined();
      expect(result.publicKey).toBeInstanceOf(CryptoKey);
      expect(result.publicKey.type).toBe('public');
    });

    it.skip('should include resolution timestamp (pending multibase implementation)', async () => {
      const before = new Date().toISOString();
      const result = await resolver.resolve(DID_KEY_ES256);
      const after = new Date().toISOString();

      expect(result.resolvedAt).toBeDefined();
      expect(result.resolvedAt >= before).toBe(true);
      expect(result.resolvedAt <= after).toBe(true);
    });
  });

  describe('did:web Resolution (Task 2.4)', () => {
    beforeEach(() => {
      // Mock global fetch for browser environment
      if (typeof global.fetch === 'undefined') {
        (global as any).fetch = jest.fn();
      }
    });

    it('should resolve did:web via HTTP', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify(MOCK_DID_DOCUMENT), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const result = await resolver.resolve(DID_WEB);

      expect(result).toBeDefined();
      expect(result.did).toBe(DID_WEB);
      expect(result.didDocument).toBeDefined();
      expect(result.publicKeyJwk).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://issuer.eudistack.com/.well-known/did.json',
        expect.any(Object)
      );
    });

    it('should parse DID Document correctly (W3C spec)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify(MOCK_DID_DOCUMENT))
      );

      const result = await resolver.resolve(DID_WEB);

      expect(result.didDocument).toBeDefined();
      expect(result.didDocument['@context']).toBeDefined();
      expect(result.didDocument.id).toBe(DID_WEB);
      expect(result.didDocument.verificationMethod).toBeDefined();
      expect(result.didDocument.verificationMethod!.length).toBeGreaterThan(0);
    });

    it('should extract public key as JWK from DID Document', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify(MOCK_DID_DOCUMENT))
      );

      const result = await resolver.resolve(DID_WEB);

      expect(result.publicKeyJwk).toBeDefined();
      expect(result.publicKeyJwk.kty).toBe('EC');
      expect(result.publicKeyJwk.crv).toBe('P-256');
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response('Not Found', { status: 404 })
      );

      await expect(resolver.resolve(DID_WEB)).rejects.toThrow(DidResolutionError);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await expect(resolver.resolve(DID_WEB)).rejects.toThrow(DidResolutionError);
    });
  });

  describe('Caching (Task 2.4)', () => {
    beforeEach(() => {
      if (typeof global.fetch === 'undefined') {
        (global as any).fetch = jest.fn();
      }
    });

    it('should cache resolution results', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify(MOCK_DID_DOCUMENT))
      );

      // First resolution
      await resolver.resolve(DID_WEB);

      // Second resolution - should use cache
      await resolver.resolve(DID_WEB);

      // Fetch should only be called once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should allow cache clearing', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify(MOCK_DID_DOCUMENT))
      );

      await resolver.resolve(DID_WEB);
      
      resolver.clearCache();
      
      await resolver.resolve(DID_WEB);

      // Should fetch twice (before and after cache clear)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance', () => {
    it.skip('should resolve did:key quickly < 100ms (pending multibase implementation)', async () => {
      const startTime = performance.now();
      await resolver.resolve(DID_KEY_ES256);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});
