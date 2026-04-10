import { TestBed } from '@angular/core/testing';
import { QrGenerationService, QrData } from './qr-generation.service';
import { VerifierApiService } from './verifier-api.service';
import { of, throwError } from 'rxjs';

/**
 * QrGenerationService Tests
 */
describe('QrGenerationService', () => {
  let service: QrGenerationService;
  let verifierApiMock: jest.Mocked<Partial<VerifierApiService>>;

  beforeEach(() => {
    verifierApiMock = {
      getAuthRequest: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        QrGenerationService,
        { provide: VerifierApiService, useValue: verifierApiMock }
      ]
    });

    service = TestBed.inject(QrGenerationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateQr', () => {
    it('should generate QR data with JWT from backend', (done) => {
      const mockJwt = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...';
      verifierApiMock.getAuthRequest?.mockReturnValue(of(mockJwt));

      service.generateQr().subscribe((qrData: QrData) => {
        expect(qrData.uri).toBe(mockJwt);
        expect(qrData.sessionId).toBeTruthy();
        expect(qrData.state).toBeTruthy();
        expect(qrData.expiresAt).toBeInstanceOf(Date);
        expect(qrData.createdAt).toBeInstanceOf(Date);
        
        // Verify expiration is in the future
        expect(qrData.expiresAt.getTime()).toBeGreaterThan(Date.now());
        
        done();
      });
    });

    it('should call backend API with session ID', (done) => {
      const mockJwt = 'jwt-token';
      verifierApiMock.getAuthRequest?.mockReturnValue(of(mockJwt));

      service.generateQr().subscribe(() => {
        expect(verifierApiMock.getAuthRequest).toHaveBeenCalledWith(
          expect.any(String) // sessionId (UUID)
        );
        done();
      });
    });

    it('should handle API errors', (done) => {
      const mockError = new Error('API Error');
      verifierApiMock.getAuthRequest?.mockReturnValue(throwError(() => mockError));

      service.generateQr().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error).toBe(mockError);
          done();
        }
      });
    });
  });

  describe('regenerateQr', () => {
    it('should generate new QR', (done) => {
      const mockJwt = 'new-jwt-token';
      verifierApiMock.getAuthRequest?.mockReturnValue(of(mockJwt));

      service.regenerateQr().subscribe((qrData: QrData) => {
        expect(qrData.uri).toBe(mockJwt);
        done();
      });
    });
  });
});
