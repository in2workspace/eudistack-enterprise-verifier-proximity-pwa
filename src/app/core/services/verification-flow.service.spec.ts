import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { VerificationFlowService, VerificationState } from './verification-flow.service';
import { QrGenerationService, QrData } from './qr-generation.service';
import { SseListenerService, LoginEvent } from './sse-listener.service';

class MockTranslateService {
  public instant(key: string): string { return key; }
}

describe('VerificationFlowService', () => {
  let service: VerificationFlowService;
  let qrMock: jest.Mocked<Pick<QrGenerationService, 'generateQr' | 'createFromAuthRequest'>>;
  let sseMock: jest.Mocked<Pick<SseListenerService, 'stream'>>;

  const mockQrData: QrData = {
    uri: 'openid4vp://?client_id=test&request_uri=https://example.com/req/session-123',
    sessionId: 'session-123',
    state: 'state-abc',
    expiresAt: new Date(Date.now() + 120000),
    createdAt: new Date()
  };

  beforeEach(() => {
    qrMock = {
      generateQr: jest.fn(),
      createFromAuthRequest: jest.fn()
    };
    sseMock = {
      stream: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        VerificationFlowService,
        { provide: QrGenerationService, useValue: qrMock },
        { provide: SseListenerService, useValue: sseMock },
        { provide: TranslateService, useClass: MockTranslateService }
      ]
    });

    service = TestBed.inject(VerificationFlowService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── startFromAuthRequest ────────────────────────────────────────────────────

  describe('startFromAuthRequest', () => {
    it('should emit a waiting state with the QR data as the first emission', (done) => {
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of());

      service.startFromAuthRequest('openid4vp://authorize?...', 'state-abc').subscribe({
        next: state => {
          if (state.status === 'waiting') {
            expect((state as { status: 'waiting'; qrData: QrData }).qrData).toEqual(mockQrData);
            done();
          }
        }
      });
    });

    it('should call createFromAuthRequest with the provided authRequest and state', (done) => {
      const authRequest = 'openid4vp://authorize?request_uri=https://example.com/req';
      const state = 'state-abc';
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of());

      service.startFromAuthRequest(authRequest, state).subscribe({
        complete: () => {
          expect(qrMock.createFromAuthRequest).toHaveBeenCalledWith(authRequest, state);
          done();
        }
      });
    });

    it('should start the SSE stream using the state from QR data', (done) => {
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of());

      service.startFromAuthRequest('...', 'state-abc').subscribe({
        complete: () => {
          expect(sseMock.stream).toHaveBeenCalledWith(mockQrData.state);
          done();
        }
      });
    });

    it('should emit a validating state when SSE signals wallet activity', (done) => {
      const sseEvent: LoginEvent = {
        type: 'validating', redirectUrl: undefined, userData: undefined,
        errorCode: undefined, error: undefined
      };
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of(sseEvent));

      const states: VerificationState[] = [];
      service.startFromAuthRequest('...', 'state').subscribe({
        next: s => states.push(s),
        complete: () => {
          expect(states.some(s => s.status === 'validating')).toBe(true);
          done();
        }
      });
    });

    it('should emit a progress state with validation results and user data', (done) => {
      const sseEvent: LoginEvent = {
        type: 'progress',
        redirectUrl: undefined,
        userData: { name: 'John', given_name: 'John', family_name: 'Doe' },
        validationResults: [true, true, true, true],
        errorCode: undefined,
        error: undefined
      };
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of(sseEvent));

      service.startFromAuthRequest('...', 'state').subscribe({
        next: s => {
          if (s.status === 'progress') {
            expect(s.validationResults).toEqual([true, true, true, true]);
            expect(s.userData).toEqual({ name: 'John', given_name: 'John', family_name: 'Doe' });
            done();
          }
        }
      });
    });

    it('should emit a progress state with failed revocation result', (done) => {
      const sseEvent: LoginEvent = {
        type: 'progress',
        redirectUrl: undefined,
        userData: undefined,
        validationResults: [true, true, true, false],
        errorCode: 'CREDENTIAL_REVOKED',
        error: 'Credential is revoked'
      };
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of(sseEvent));

      service.startFromAuthRequest('...', 'state').subscribe({
        next: s => {
          if (s.status === 'progress') {
            expect(s.validationResults).toEqual([true, true, true, false]);
            done();
          }
        }
      });
    });

    it('should emit an error state when the SSE stream errors', (done) => {
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(
        throwError(() => ({ code: 'SSE_TIMEOUT', message: 'Timed out' }))
      );

      service.startFromAuthRequest('...', 'state').subscribe({
        next: s => {
          if (s.status === 'error') {
            expect(s.error.code).toBe('SSE_TIMEOUT');
            done();
          }
        }
      });
    });

    it('should emit an error state when QR creation fails', (done) => {
      qrMock.createFromAuthRequest.mockReturnValue(
        throwError(() => ({ code: 'AUTH_ERROR', message: 'Auth failed' }))
      );

      service.startFromAuthRequest('...', 'state').subscribe({
        next: s => {
          if (s.status === 'error') {
            expect(s.error.code).toBe('AUTH_ERROR');
            done();
          }
        }
      });
    });
  });

  // ── startVerification ───────────────────────────────────────────────────────

  describe('startVerification', () => {
    it('should emit a waiting state with generated QR data', (done) => {
      qrMock.generateQr.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of());

      service.startVerification().subscribe({
        next: s => {
          if (s.status === 'waiting') {
            expect((s as { status: 'waiting'; qrData: QrData }).qrData).toEqual(mockQrData);
            done();
          }
        }
      });
    });

    it('should call generateQr and then start the SSE stream', (done) => {
      qrMock.generateQr.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of());

      service.startVerification().subscribe({
        complete: () => {
          expect(qrMock.generateQr).toHaveBeenCalled();
          expect(sseMock.stream).toHaveBeenCalledWith(mockQrData.state);
          done();
        }
      });
    });

    it('should emit an error state when QR generation fails', (done) => {
      qrMock.generateQr.mockReturnValue(
        throwError(() => ({ code: 'QR_ERROR', message: 'QR failed' }))
      );

      service.startVerification().subscribe({
        next: s => {
          if (s.status === 'error') {
            expect(s.error.code).toBe('QR_ERROR');
            done();
          }
        }
      });
    });
  });

  // ── cancelVerification ──────────────────────────────────────────────────────

  describe('cancelVerification', () => {
    it('should complete the observable when called mid-stream', (done) => {
      qrMock.createFromAuthRequest.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(new Observable()); // never emits

      service.startFromAuthRequest('...', 'state').subscribe({
        complete: () => done()
      });

      service.cancelVerification();
    });
  });

  // ── regenerateQr ────────────────────────────────────────────────────────────

  describe('regenerateQr', () => {
    it('should restart the verification flow and emit a waiting state', (done) => {
      qrMock.generateQr.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of());

      service.regenerateQr().subscribe({
        next: s => {
          if (s.status === 'waiting') {
            expect((s as { status: 'waiting'; qrData: QrData }).qrData).toEqual(mockQrData);
            done();
          }
        }
      });
    });

    it('should call generateQr for the new flow', (done) => {
      qrMock.generateQr.mockReturnValue(of(mockQrData));
      sseMock.stream.mockReturnValue(of());

      service.regenerateQr().subscribe({
        complete: () => {
          expect(qrMock.generateQr).toHaveBeenCalled();
          done();
        }
      });
    });
  });
});
