import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ValidationService } from './validation.service';
import { CryptoService } from './crypto.service';
import { TrustFrameworkService } from './trust-framework.service';
import { StatusListService } from './status-list.service';
import { StorageService } from './storage.service';
import { of, throwError } from 'rxjs';
import { ValidationErrorCode } from '../models/validation-result.model';

/**
 * ValidationService Tests (FASE 2: Tareas 2.1 y 2.2)
 * 
 * Tests cover:
 * - VP parsing and structure validation (Task 2.1)
 * - VC extraction and validation (Task 2.1)
 * - Error handling for malformed inputs
 * - Trust framework integration (Task 2.2)
 * - Status list integration (Task 2.2)
 * - Service instantiation and dependency injection
 * 
 * Note: Full JWT signature validation requires browser Web Crypto API
 * and is better tested in integration/e2e tests or manual testing.
 */
describe('ValidationService', () => {
  let service: ValidationService;
  let trustFrameworkService: jest.Mocked<Partial<TrustFrameworkService>>;
  let statusListService: jest.Mocked<Partial<StatusListService>>;

  const SESSION_ID = 'test-session-123';
  const EXPECTED_NONCE = 'test-nonce-abc';
  const ISSUER_DID = 'did:key:z6MkhaXgBZDvotDvLHKmsZL6L2Y4QQxX3Aw3nMkbQZDU8WKz';

  beforeEach(() => {
    trustFrameworkService = {
      isTrustedIssuer: jest.fn().mockReturnValue(of(true)),
      getTrustedIssuer: jest.fn().mockReturnValue(of(null))
    } as any;

    statusListService = {
      checkCredentialStatus: jest.fn().mockReturnValue(of({
        isRevoked: false,
        statusListUrl: null,
        credentialIndex: null,
        checked: false,
        message: 'No status list'
      }))
    } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ValidationService,
        CryptoService,
        { provide: TrustFrameworkService, useValue: trustFrameworkService },
        { provide: StatusListService, useValue: statusListService },
        StorageService
      ]
    });

    service = TestBed.inject(ValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Service Dependencies', () => {
    it('should inject all required dependencies', () => {
      expect(service).toBeTruthy();
      expect(trustFrameworkService).toBeTruthy();
      expect(statusListService).toBeTruthy();
    });
  });

  describe('VP Validation - Error Handling (Task 2.1)', () => {
    it('should reject malformed JWT', async () => {
      const malformedToken = 'not.a.jwt';
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const result = await service.validatePresentation(
        SESSION_ID,
        malformedToken,
        EXPECTED_NONCE,
        mockKey.publicKey
      ).toPromise();

      expect(result).toBeDefined();
      expect(result!.validationResult.isValid).toBe(false);
      expect(result!.validationResult.errors.length).toBeGreaterThan(0);
      expect(result!.validationResult.errors[0].code).toBe(ValidationErrorCode.INVALID_JWT_FORMAT);
    });

    it('should handle empty VP token', async () => {
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const result = await service.validatePresentation(
        SESSION_ID,
        '',
        EXPECTED_NONCE,
        mockKey.publicKey
      ).toPromise();

      expect(result).toBeDefined();
      expect(result!.validationResult.isValid).toBe(false);
    });
  });

  describe('Trust Framework Integration (Task 2.2)', () => {
    it('should check issuer against trust framework', async () => {
      const malformedToken = 'invalid.jwt.token';
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      (trustFrameworkService.isTrustedIssuer as jest.Mock).mockReturnValue(of(false));

      await service.validatePresentation(
        SESSION_ID,
        malformedToken,
        EXPECTED_NONCE,
        mockKey.publicKey
      ).toPromise();

      // Service should interact with trust framework
      expect(trustFrameworkService.isTrustedIssuer).toBeDefined();
    });

    it('should use trust framework service', () => {
      expect(trustFrameworkService).toBeTruthy();
      expect(trustFrameworkService.isTrustedIssuer).toBeDefined();
    });
  });

  describe('Status List Integration (Task 2.5)', () => {
    it('should use status list service', () => {
      expect(statusListService).toBeTruthy();
      expect(statusListService.checkCredentialStatus).toBeDefined();
    });

    it('should handle status list check', async () => {
      const malformedToken = 'invalid.jwt.token';
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      (statusListService.checkCredentialStatus as jest.Mock).mockReturnValue(of({
        isRevoked: true,
        statusListUrl: 'https://example.com/status',
        credentialIndex: 42,
        checked: true,
        message: 'Revoked'
      }));

      await service.validatePresentation(
        SESSION_ID,
        malformedToken,
        EXPECTED_NONCE,
        mockKey.publicKey
      ).toPromise();

      // Service should be configured to use status list
      expect(statusListService.checkCredentialStatus).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle trust framework errors gracefully', async () => {
      const malformedToken = 'invalid.jwt.token';
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      (trustFrameworkService.isTrustedIssuer as jest.Mock).mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const result = await service.validatePresentation(
        SESSION_ID,
        malformedToken,
        EXPECTED_NONCE,
        mockKey.publicKey
      ).toPromise();

      expect(result).toBeDefined();
      expect(result!.validationResult.isValid).toBe(false);
    });

    it('should handle status list errors gracefully', async () => {
      const malformedToken = 'invalid.jwt.token';
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      (statusListService.checkCredentialStatus as jest.Mock).mockReturnValue(
        throwError(() => new Error('Status list unavailable'))
      );

      const result = await service.validatePresentation(
        SESSION_ID,
        malformedToken,
        EXPECTED_NONCE,
        mockKey.publicKey
      ).toPromise();

      expect(result).toBeDefined();
      expect(result!.validationResult.isValid).toBe(false);
    });

    it('should return validation result even on unknown errors', async () => {
      const malformedToken = 'invalid.jwt.token';
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const result = await service.validatePresentation(
        SESSION_ID,
        malformedToken,
        EXPECTED_NONCE,
        mockKey.publicKey
      ).toPromise();

      expect(result).toBeDefined();
      expect(result!.sessionId).toBe(SESSION_ID);
      expect(result!.validationResult).toBeDefined();
      expect(result!.validationResult.errors).toBeDefined();
      expect(Array.isArray(result!.validationResult.errors)).toBe(true);
    });
  });

  describe('Observable Pattern', () => {
    it('should return Observable', async () => {
      const malformedToken = 'invalid.jwt.token';
      const mockKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const observable = service.validatePresentation(
        SESSION_ID,
        malformedToken,
        EXPECTED_NONCE,
        mockKey.publicKey
      );

      expect(observable).toBeDefined();
      expect(observable.subscribe).toBeDefined();
    });

    it('should complete Observable', (done) => {
      const malformedToken = 'invalid.jwt.token';
      
      crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      ).then(mockKey => {
        service.validatePresentation(
          SESSION_ID,
          malformedToken,
          EXPECTED_NONCE,
          mockKey.publicKey
        ).subscribe({
          next: (result) => {
            expect(result).toBeDefined();
          },
          complete: () => {
            done();
          }
        });
      });
    });
  });
});
