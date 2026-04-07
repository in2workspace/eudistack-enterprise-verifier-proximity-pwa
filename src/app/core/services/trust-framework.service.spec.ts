import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TrustFrameworkService } from './trust-framework.service';
import { StorageService } from './storage.service';
import { TrustedIssuer, IssuerStatus } from '../models/trusted-issuer.model';
import { of, throwError } from 'rxjs';

/**
 * TrustFrameworkService Tests (FASE 2: Tarea 2.3)
 * 
 * Tests cover:
 * - Load trust list from JSON file
 * - Synchronize to IndexedDB on startup
 * - isTrustedIssuer() returns correct values
 * - Lookup by issuer DID
 * - Fast lookup performance (< 50ms)
 */
describe('TrustFrameworkService', () => {
  let service: TrustFrameworkService;
  let httpMock: HttpTestingController;
  let storageService: jest.Mocked<Partial<StorageService>>;

  const TRUST_FRAMEWORK_PATH = '/assets/trust-framework/trusted-issuers.json';

  const MOCK_TRUST_FRAMEWORK = {
    version: '1.0.0',
    lastUpdated: '2026-04-02T00:00:00Z',
    description: 'Test trust framework',
    trustedIssuers: [
      {
        issuerId: 'did:key:z6MkhaXgBZDvotDvLHKmsZL6L2Y4QQxX3Aw3nMkbQZDU8WKz',
        name: 'EUDI Demo Issuer',
        description: 'Demo issuer',
        credentialTypes: ['LEARCredentialEmployee'],
        trustLevel: 3,
        status: IssuerStatus.ACTIVE,
        jwksUri: 'https://issuer.example.com/.well-known/jwks.json',
        logoUrl: 'https://issuer.example.com/logo.png',
        isEidas: false,
        supportedAlgorithms: ['ES256'],
        lastUpdated: '2026-04-02T00:00:00Z'
      },
      {
        issuerId: 'did:key:z6MkrfRbLvNZn5tgopZKjPMqT5XqYMnTHqvHKJD8wWoFqGkZ',
        name: 'Suspended Issuer',
        description: 'Suspended test issuer',
        credentialTypes: ['TestCredential'],
        trustLevel: 1,
        status: IssuerStatus.SUSPENDED,
        jwksUri: 'https://test.example.com/.well-known/jwks.json',
        logoUrl: 'https://test.example.com/logo.png',
        isEidas: false,
        supportedAlgorithms: ['ES256'],
        lastUpdated: '2026-04-02T00:00:00Z'
      }
    ],
    metadata: {
      totalIssuers: 2,
      activeIssuers: 1,
      eidasIssuers: 0
    }
  };

  beforeEach(() => {
    // Create mock for StorageService
    storageService = {
      clearTrustFramework: jest.fn().mockReturnValue(of(void 0)),
      saveTrustedIssuer: jest.fn().mockReturnValue(of(void 0)),
      getTrustedIssuer: jest.fn().mockReturnValue(of(null)),
      getAllTrustedIssuers: jest.fn().mockReturnValue(of([]))
    } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TrustFrameworkService,
        { provide: StorageService, useValue: storageService }
      ]
    });

    service = TestBed.inject(TrustFrameworkService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Load Trust Framework (Task 2.3)', () => {
    it('should load trust framework from JSON on startup', async () => {
      // Start loading
      const loadPromise = service.loadTrustFramework();

      // Expect HTTP request
      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      expect(req.request.method).toBe('GET');

      // Respond with mock data
      req.flush(MOCK_TRUST_FRAMEWORK);

      // Wait for completion
      await loadPromise;

      // Verify storage was cleared
      expect(storageService.clearTrustFramework).toHaveBeenCalled();

      // Verify all issuers were saved
      expect(storageService.saveTrustedIssuer).toHaveBeenCalledTimes(2);
    });

    it('should synchronize trust list to IndexedDB', async () => {
      const loadPromise = service.loadTrustFramework();

      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      req.flush(MOCK_TRUST_FRAMEWORK);

      await loadPromise;

      // Verify clear was called before saving
      expect(storageService.clearTrustFramework).toHaveBeenCalled();

      // Verify save was called for each issuer
      expect(storageService.saveTrustedIssuer).toHaveBeenCalledTimes(2);
    });

    it('should handle load failure', async () => {
      const loadPromise = service.loadTrustFramework();

      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      req.error(new ProgressEvent('error'), { status: 404, statusText: 'Not Found' });

      await expect(loadPromise).rejects.toThrow();
    });

    it('should handle storage errors during load', async () => {
      storageService.clearTrustFramework = jest.fn().mockReturnValue(
        throwError(() => new Error('Storage error'))
      );

      const loadPromise = service.loadTrustFramework();

      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      req.flush(MOCK_TRUST_FRAMEWORK);

      await expect(loadPromise).rejects.toThrow();
    });
  });

  describe('isTrustedIssuer() (Task 2.3)', () => {
    beforeEach(async () => {
      // Load trust framework before each test
      const loadPromise = service.loadTrustFramework();
      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      req.flush(MOCK_TRUST_FRAMEWORK);
      await loadPromise;
    });

    it('should return true for trusted active issuer', (done) => {
      const trustedIssuerId = 'did:key:z6MkhaXgBZDvotDvLHKmsZL6L2Y4QQxX3Aw3nMkbQZDU8WKz';

      (storageService.getTrustedIssuer as jest.Mock).mockReturnValue(of(MOCK_TRUST_FRAMEWORK.trustedIssuers[0]));

      service.isTrustedIssuer(trustedIssuerId).subscribe(isTrusted => {
        expect(isTrusted).toBe(true);
        done();
      });
    });

    it('should return false for non-existent issuer', (done) => {
      const unknownIssuerId = 'did:key:z6MkUnknownIssuer';

      (storageService.getTrustedIssuer as jest.Mock).mockReturnValue(of(null));

      service.isTrustedIssuer(unknownIssuerId).subscribe(isTrusted => {
        expect(isTrusted).toBe(false);
        done();
      });
    });

    it('should return false for suspended issuer', (done) => {
      const suspendedIssuerId = 'did:key:z6MkrfRbLvNZn5tgopZKjPMqT5XqYMnTHqvHKJD8wWoFqGkZ';

      (storageService.getTrustedIssuer as jest.Mock).mockReturnValue(of(MOCK_TRUST_FRAMEWORK.trustedIssuers[1]));

      service.isTrustedIssuer(suspendedIssuerId).subscribe(isTrusted => {
        expect(isTrusted).toBe(false);
        done();
      });
    });

    it('should handle errors gracefully', (done) => {
      (storageService.getTrustedIssuer as jest.Mock).mockReturnValue(
        throwError(() => new Error('Database error'))
      );

      service.isTrustedIssuer('did:key:test').subscribe(isTrusted => {
        expect(isTrusted).toBe(false);
        done();
      });
    });
  });

  describe('getTrustedIssuer() (Task 2.3)', () => {
    beforeEach(async () => {
      const loadPromise = service.loadTrustFramework();
      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      req.flush(MOCK_TRUST_FRAMEWORK);
      await loadPromise;
    });

    it('should return issuer details for valid issuer', (done) => {
      const issuerId = 'did:key:z6MkhaXgBZDvotDvLHKmsZL6L2Y4QQxX3Aw3nMkbQZDU8WKz';
      const expectedIssuer = MOCK_TRUST_FRAMEWORK.trustedIssuers[0];

      (storageService.getTrustedIssuer as jest.Mock).mockReturnValue(of(expectedIssuer));

      service.getTrustedIssuer(issuerId).subscribe(issuer => {
        expect(issuer).toBeDefined();
        expect(issuer?.issuerId).toBe(issuerId);
        expect(issuer?.name).toBe('EUDI Demo Issuer');
        done();
      });
    });

    it('should return null for non-existent issuer', (done) => {
      (storageService.getTrustedIssuer as jest.Mock).mockReturnValue(of(null));

      service.getTrustedIssuer('did:key:unknown').subscribe(issuer => {
        expect(issuer).toBeNull();
        done();
      });
    });
  });

  describe('Performance (Task 2.3)', () => {
    it('should perform lookup in < 50ms', async () => {
      const loadPromise = service.loadTrustFramework();
      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      req.flush(MOCK_TRUST_FRAMEWORK);
      await loadPromise;

      const issuerId = 'did:key:z6MkhaXgBZDvotDvLHKmsZL6L2Y4QQxX3Aw3nMkbQZDU8WKz';
      (storageService.getTrustedIssuer as jest.Mock).mockReturnValue(of(MOCK_TRUST_FRAMEWORK.trustedIssuers[0]));

      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        service.isTrustedIssuer(issuerId).subscribe(() => {
          const duration = performance.now() - startTime;
          expect(duration).toBeLessThan(50);
          resolve();
        });
      });
    });
  });

  describe('JSON Structure (Task 2.3)', () => {
    it('should parse valid JSON structure', async () => {
      const loadPromise = service.loadTrustFramework();

      const req = httpMock.expectOne(TRUST_FRAMEWORK_PATH);
      req.flush(MOCK_TRUST_FRAMEWORK);

      await expect(loadPromise).resolves.not.toThrow();
    });
  });
});
