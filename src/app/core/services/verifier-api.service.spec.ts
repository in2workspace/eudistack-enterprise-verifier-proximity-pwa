import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VerifierApiService, VerifierApiError } from './verifier-api.service';

/**
 * VerifierApiService Tests
 * 
 * Tests HTTP client functionality for backend API integration.
 */
describe('VerifierApiService', () => {
  let service: VerifierApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Setup window.env for testing
    (window as any)['env'] = {
      verifierBackendUrl: 'http://test-backend.com'
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VerifierApiService]
    });

    service = TestBed.inject(VerifierApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure no outstanding HTTP requests
    delete (window as any)['env'];
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAuthRequest', () => {
    it('should call GET /oid4vp/auth-request/{id}', () => {
      const sessionId = 'test-session-123';
      const mockJwt = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...';

      service.getAuthRequest(sessionId).subscribe(jwt => {
        expect(jwt).toBe(mockJwt);
      });

      const req = httpMock.expectOne(`http://test-backend.com/oid4vp/auth-request/${sessionId}`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('text');
      
      req.flush(mockJwt);
    });

    it('should handle 404 error (session not found)', () => {
      const sessionId = 'invalid-session';

      service.getAuthRequest(sessionId).subscribe({
        next: () => fail('Should have failed'),
        error: (error: VerifierApiError) => {
          expect(error).toBeInstanceOf(VerifierApiError);
          expect(error.code).toBe('SESSION_NOT_FOUND');
          expect(error.statusCode).toBe(404);
        }
      });

      const req = httpMock.expectOne(`http://test-backend.com/oid4vp/auth-request/${sessionId}`);
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    });

    it('should handle 500 error (server error)', () => {
      const sessionId = 'test-session';

      service.getAuthRequest(sessionId).subscribe({
        next: () => fail('Should have failed'),
        error: (error: VerifierApiError) => {
          expect(error).toBeInstanceOf(VerifierApiError);
          expect(error.code).toBe('SERVER_ERROR');
          expect(error.statusCode).toBe(500);
        }
      });

      const req = httpMock.expectOne(`http://test-backend.com/oid4vp/auth-request/${sessionId}`);
      req.flush('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle network error (status 0)', () => {
      const sessionId = 'test-session';

      service.getAuthRequest(sessionId).subscribe({
        next: () => fail('Should have failed'),
        error: (error: VerifierApiError) => {
          expect(error).toBeInstanceOf(VerifierApiError);
          expect(error.code).toBe('NETWORK_ERROR');
          expect(error.statusCode).toBe(0);
        }
      });

      const req = httpMock.expectOne(`http://test-backend.com/oid4vp/auth-request/${sessionId}`);
      req.error(new ProgressEvent('error'));
    });
  });

  describe('Backend URL configuration', () => {
    it('should use window.env.verifierBackendUrl if available', () => {
      const sessionId = 'test';
      
      service.getAuthRequest(sessionId).subscribe();
      
      const req = httpMock.expectOne(`http://test-backend.com/oid4vp/auth-request/${sessionId}`);
      req.flush('jwt');
    });
  });
});
