import { TestBed } from '@angular/core/testing';
import { SessionStateService } from './session-state.service';
import { CryptoService } from './crypto.service';

/**
 * SessionStateService Tests
 * 
 * Note: Most tests are skipped in Node.js because they depend on JWT signing.
 * Use the Phase 1 Demo page in a browser for comprehensive testing.
 */
describe('SessionStateService', () => {
  let service: SessionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SessionStateService, CryptoService]
    });
    service = TestBed.inject(SessionStateService);
  });

  afterEach(() => {
    service.clearSession();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Session State Management', () => {
    it('should get current session as null before creation', () => {
      const current = service.getCurrentSession();
      expect(current).toBeNull();
    });

    it('should get session timeout duration', () => {
      const timeout = service.getSessionTimeout();
      expect(timeout).toBe(120);
    });

    // Note: createSession tests are skipped in Node.js due to Web Crypto API.
    // Custom timeout functionality is verified in the Phase 1 Demo page.
    it.skip('should respect custom timeout when creating session', async () => {
      const customTimeout = 60;
      const session = await service.createSession({ timeoutSeconds: customTimeout });
      
      const now = Date.now();
      const expiresAt = new Date(session.expiresAt).getTime();
      const actualTimeout = Math.floor((expiresAt - now) / 1000);
      
      // Allow 1 second tolerance for execution time
      expect(actualTimeout).toBeGreaterThanOrEqual(customTimeout - 1);
      expect(actualTimeout).toBeLessThanOrEqual(customTimeout + 1);
    });
  });
});
