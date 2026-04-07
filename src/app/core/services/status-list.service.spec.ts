import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StatusListService } from './status-list.service';
import { StorageService } from './storage.service';
import { of, throwError } from 'rxjs';

/**
 * StatusListService Tests (FASE 2: Tarea 2.5)
 * 
 * Tests cover:
 * - Extract status_list claim from VC
 * - Parse Bitstring Status List (W3C spec)
 * - Caching of Status Lists (5min TTL)
 * - Graceful error handling (doesn't block validation)
 */
describe('StatusListService', () => {
  let service: StatusListService;
  let httpMock: HttpTestingController;
  let storageService: jest.Mocked<Partial<StorageService>>;

  const STATUS_LIST_URL = 'https://issuer.example.com/status/1';

  const MOCK_STATUS_LIST_CREDENTIAL = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3c.github.io/vc-bitstring-status-list/contexts/v1'
    ],
    id: 'https://issuer.example.com/status/1',
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: 'https://issuer.example.com',
    issuanceDate: '2024-01-01T00:00:00Z',
    credentialSubject: {
      id: 'https://issuer.example.com/status/1#list',
      type: 'BitstringStatusList',
      statusPurpose: 'revocation',
      encodedList: 'H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA'
    }
  };

  const MOCK_VC_PAYLOAD_WITH_STATUS: any = {
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'LEARCredentialEmployee'],
      credentialSubject: { id: 'did:example:holder' },
      credentialStatus: {
        type: 'BitstringStatusListEntry',
        statusListCredential: STATUS_LIST_URL,
        statusListIndex: '42',
        statusPurpose: 'revocation'
      }
    },
    iss: 'did:example:issuer',
    sub: 'did:example:holder'
  };

  const MOCK_VC_PAYLOAD_NO_STATUS: any = {
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential'],
      credentialSubject: { id: 'did:example:holder' }
    },
    iss: 'did:example:issuer',
    sub: 'did:example:holder'
  };

  beforeEach(() => {
    storageService = {
      getStatusListEntry: jest.fn().mockReturnValue(of(null)),
      saveStatusListEntry: jest.fn().mockReturnValue(of(void 0))
    } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        StatusListService,
        { provide: StorageService, useValue: storageService }
      ]
    });

    service = TestBed.inject(StatusListService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Extract Status List Claim (Task 2.5)', () => {
    it('should extract credentialStatus from VC', (done) => {
      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result.statusListUrl).toBe(STATUS_LIST_URL);
        expect(result.credentialIndex).toBe(42);
        done();
      });

      // Wait for Promise microtask to complete before HTTP request is made
      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.flush(MOCK_STATUS_LIST_CREDENTIAL);
      }, 0);
    });

    it('should handle VC without credentialStatus', (done) => {
      service.checkCredentialStatus(MOCK_VC_PAYLOAD_NO_STATUS).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        expect(result.statusListUrl).toBeNull();
        expect(result.message).toContain('No credential status');
        done();
      });
    });

    it('should handle unsupported status type', (done) => {
      const vcWithUnsupportedStatus: any = {
        ...MOCK_VC_PAYLOAD_NO_STATUS,
        vc: {
          ...MOCK_VC_PAYLOAD_NO_STATUS.vc,
          credentialStatus: {
            type: 'UnsupportedStatusType',
            statusListCredential: STATUS_LIST_URL,
            statusListIndex: '42'
          }
        }
      };

      service.checkCredentialStatus(vcWithUnsupportedStatus).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        expect(result.message).toContain('Unsupported status type');
        done();
      });
    });

    it('should handle invalid status configuration', (done) => {
      const vcWithInvalidStatus: any = {
        ...MOCK_VC_PAYLOAD_NO_STATUS,
        vc: {
          ...MOCK_VC_PAYLOAD_NO_STATUS.vc,
          credentialStatus: {
            type: 'BitstringStatusListEntry',
            statusListCredential: '',
            statusListIndex: 'invalid'
          }
        }
      };

      service.checkCredentialStatus(vcWithInvalidStatus).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        expect(result.message).toContain('Invalid status list configuration');
        done();
      });
    });
  });

  describe('Parse Bitstring Status List (Task 2.5)', () =>{
    it('should parse valid bitstring status list', (done) => {
      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result.checked).toBe(true);
        expect(result.statusListUrl).toBe(STATUS_LIST_URL);
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        expect(req.request.headers.get('Accept')).toContain('application/vc+ld+json');
        req.flush(MOCK_STATUS_LIST_CREDENTIAL);
      }, 0);
    });

    it('should correctly decode compressed bitstring', (done) => {
      const vcPayload: any = {
        ...MOCK_VC_PAYLOAD_WITH_STATUS,
        vc: {
          ...MOCK_VC_PAYLOAD_WITH_STATUS.vc,
          credentialStatus: {
            ...MOCK_VC_PAYLOAD_WITH_STATUS.vc.credentialStatus,
            statusListIndex: '0' // Index 0 should NOT be revoked
          }
        }
      };

      service.checkCredentialStatus(vcPayload).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(true);
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.flush(MOCK_STATUS_LIST_CREDENTIAL);
      }, 0);
    });
  });

  describe('Caching (Task 2.5)', () => {
    it('should cache status list entries for 5 minutes', (done) => {
      const cachedEntry: any = {
        statusListUrl: STATUS_LIST_URL,
        credentialIndex: 42,
        isRevoked: false,
        lastCheckedAt: new Date().toISOString(),
        cacheTtlSeconds: 300 // 5 min
      };

      (storageService.getStatusListEntry as jest.Mock).mockReturnValue(of(cachedEntry));

      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.message).toContain('Cached');
        done();
      });

      // Should NOT make HTTP request if cached
      httpMock.expectNone(STATUS_LIST_URL);
    });

    it('should fetch new status list if cache expired', (done) => {
      const expiredEntry: any = {
        statusListUrl: STATUS_LIST_URL,
        credentialIndex: 42,
        isRevoked: false,
        lastCheckedAt: new Date(Date.now() - 400000).toISOString(), // 6 min ago
        cacheTtlSeconds: 300 // 5 min TTL
      };

      (storageService.getStatusListEntry as jest.Mock).mockReturnValue(of(expiredEntry));

      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result.checked).toBe(true);
        done();
      });

      // Should make HTTP request because cache expired
      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.flush(MOCK_STATUS_LIST_CREDENTIAL);
      }, 0);
    });

    it('should save fetched status to cache', (done) => {
      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(() => {
        expect(storageService.saveStatusListEntry).toHaveBeenCalled();
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.flush(MOCK_STATUS_LIST_CREDENTIAL);
      }, 0);
    });
  });

  describe('Graceful Error Handling (Task 2.5)', () => {
    it('should not block validation if status list unavailable', (done) => {
      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        expect(result.message).toContain('Error');
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.error(new ProgressEvent('error'), { status: 404, statusText: 'Not Found' });
      }, 0);
    });

    it('should handle network errors gracefully', (done) => {
      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.error(new ProgressEvent('error'), { status: 0, statusText: 'Network error' });
      }, 0);
    });

    it('should handle malformed status list credential', (done) => {
      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.flush({ invalid: 'data' }); // Malformed response
      }, 0);
    });

    it('should handle storage errors during cache operations', (done) => {
      (storageService.getStatusListEntry as jest.Mock).mockReturnValue(
        throwError(() => new Error('IndexedDB error'))
      );

      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        // Service should handle error gracefully and fall back to HTTP fetch
        expect(result).toBeDefined();
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.flush(MOCK_STATUS_LIST_CREDENTIAL);
      }, 0);
    });

    it('should log warnings but not throw', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.checkCredentialStatus(MOCK_VC_PAYLOAD_WITH_STATUS).subscribe(result => {
        expect(result).toBeDefined();
        expect(result.isRevoked).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
        done();
      });

      setTimeout(() => {
        const req = httpMock.expectOne(STATUS_LIST_URL);
        req.error(new ProgressEvent('error'));
      }, 0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined vc property', (done) => {
      const vcPayloadNoVc: any = {
        iss: 'did:example:issuer',
        sub: 'did:example:holder'
      };

      service.checkCredentialStatus(vcPayloadNoVc).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        done();
      });
    });

    it('should handle unexpected errors', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Pass invalid input that will cause unexpected error
      service.checkCredentialStatus(null as any).subscribe(result => {
        expect(result.isRevoked).toBe(false);
        expect(result.checked).toBe(false);
        expect(result.message).toContain('Unexpected error');
        consoleSpy.mockRestore();
        done();
      });
    });
  });
});
