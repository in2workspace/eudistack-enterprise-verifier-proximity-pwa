import { TestBed } from '@angular/core/testing';
import { QrGenerationService, QrData } from './qr-generation.service';
import { VerifierApiService } from './verifier-api.service';
import { of, throwError } from 'rxjs';

/**
 * QrGenerationService Tests
 */
describe('QrGenerationService', () => {
  let service: QrGenerationService;
  let verifierApiMock: jest.Mocked<VerifierApiService>;

  beforeEach(() => {
    verifierApiMock = {
      initiateVerification: jest.fn()
    } as unknown as jest.Mocked<VerifierApiService>;

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
      const mockSession = {
        sessionId: 'test-session-id',
        state: 'test-state',
        authRequest: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...'
      };
      (verifierApiMock.initiateVerification as jest.Mock).mockReturnValue(of(mockSession));

      service.generateQr().subscribe((qrData: QrData) => {
        expect(qrData.uri).toBe(mockSession.authRequest);
        expect(qrData.sessionId).toBe(mockSession.sessionId);
        expect(qrData.state).toBe(mockSession.state);
        expect(qrData.expiresAt).toBeInstanceOf(Date);
        expect(qrData.createdAt).toBeInstanceOf(Date);
        
        // Verify expiration is in the future
        expect(qrData.expiresAt.getTime()).toBeGreaterThan(Date.now());
        
        done();
      });
    });

    it('should call backend API to initiate verification', (done) => {
      const mockSession = {
        sessionId: 'test-session-id',
        state: 'test-state',
        authRequest: 'jwt-token'
      };
      (verifierApiMock.initiateVerification as jest.Mock).mockReturnValue(of(mockSession));

      service.generateQr().subscribe(() => {
        expect(verifierApiMock.initiateVerification).toHaveBeenCalled();
        done();
      });
    });

    it('should handle API errors', (done) => {
      const mockError = new Error('API Error');
      (verifierApiMock.initiateVerification as jest.Mock).mockReturnValue(throwError(() => mockError));

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
      const mockSession = {
        sessionId: 'new-session-id',
        state: 'new-state',
        authRequest: 'new-jwt-token'
      };
      (verifierApiMock.initiateVerification as jest.Mock).mockReturnValue(of(mockSession));

      service.regenerateQr().subscribe((qrData: QrData) => {
        expect(qrData.uri).toBe(mockSession.authRequest);
        done();
      });
    });
  });
});
