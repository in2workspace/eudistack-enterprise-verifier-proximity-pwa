import { TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';
import { SseListenerService, LoginEvent, SseError } from './sse-listener.service';

class MockTranslateService {
  public instant(key: string): string { return key; }
}

/**
 * Minimal EventSource mock.
 * Stores listeners per event type and allows manual triggering.
 */
class MockEventSource {
  static instances: MockEventSource[] = [];
  readyState = 1; // OPEN
  private listeners: Record<string, Array<(e: unknown) => void>> = {};

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: unknown) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  /** Dispatch a named event with optional data payload. */
  trigger(type: string, data?: unknown): void {
    const event = type === 'error'
      ? { target: { readyState: 2 } }   // simulate a closed-state error
      : { data };
    (this.listeners[type] ?? []).forEach(l => l(event));
  }

  close(): void { this.readyState = 2; }
}

describe('SseListenerService', () => {
  let service: SseListenerService;
  let httpMock: HttpTestingController;
  let OriginalEventSource: typeof EventSource;

  beforeEach(() => {
    MockEventSource.instances = [];
    OriginalEventSource = (window as Window & typeof globalThis).EventSource;
    (window as unknown as Record<string, unknown>)['EventSource'] = MockEventSource;

    TestBed.configureTestingModule({
      providers: [
        SseListenerService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useClass: MockTranslateService }
      ]
    });

    service = TestBed.inject(SseListenerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>)['EventSource'] = OriginalEventSource;
    sessionStorage.clear();
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should open an EventSource with the state encoded in the URL', () => {
    service.stream('my-state-123').subscribe();

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toContain('state=my-state-123');
  });

  it('should emit a validating event when a generic SSE message arrives', fakeAsync(() => {
    const events: LoginEvent[] = [];
    const sub = service.stream('state').subscribe(e => events.push(e));

    MockEventSource.instances[0].trigger('message', 'wallet-ping');

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('validating');

    sub.unsubscribe(); // cancel pending timeout timer so fakeAsync exits cleanly
  }));

  describe('validation_failed events', () => {
    it('should mark revocation check (index 3) as failed for CREDENTIAL_REVOKED', fakeAsync(() => {
      const events: LoginEvent[] = [];
      service.stream('state').subscribe(e => events.push(e));

      MockEventSource.instances[0].trigger(
        'validation_failed',
        JSON.stringify({ code: 'CREDENTIAL_REVOKED', message: 'Revoked' })
      );

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('progress');
      expect(events[0].validationResults).toEqual([true, true, true, false]);
      expect(events[0].errorCode).toBe('CREDENTIAL_REVOKED');
    }));

    it('should mark VP signature check (index 0) as failed for SIGNATURE_INVALID', fakeAsync(() => {
      const events: LoginEvent[] = [];
      service.stream('state').subscribe(e => events.push(e));

      MockEventSource.instances[0].trigger(
        'validation_failed',
        JSON.stringify({ code: 'SIGNATURE_INVALID', message: 'Invalid' })
      );

      expect(events[0].validationResults).toEqual([false, true, true, true]);
    }));

    it('should mark trusted issuer check (index 2) as failed for ISSUER_NOT_TRUSTED', fakeAsync(() => {
      const events: LoginEvent[] = [];
      service.stream('state').subscribe(e => events.push(e));

      MockEventSource.instances[0].trigger(
        'validation_failed',
        JSON.stringify({ code: 'ISSUER_NOT_TRUSTED', message: 'Untrusted' })
      );

      expect(events[0].validationResults).toEqual([true, true, false, true]);
    }));

    it('should mark all checks as failed for CREDENTIAL_EXPIRED', fakeAsync(() => {
      const events: LoginEvent[] = [];
      service.stream('state').subscribe(e => events.push(e));

      MockEventSource.instances[0].trigger(
        'validation_failed',
        JSON.stringify({ code: 'CREDENTIAL_EXPIRED', message: 'Expired' })
      );

      expect(events[0].validationResults).toEqual([false, false, false, false]);
    }));

    it('should mark revocation check as failed for STATUS_CHECK_FAILED', fakeAsync(() => {
      const events: LoginEvent[] = [];
      service.stream('state').subscribe(e => events.push(e));

      MockEventSource.instances[0].trigger(
        'validation_failed',
        JSON.stringify({ code: 'STATUS_CHECK_FAILED', message: 'Status check failed' })
      );

      expect(events[0].validationResults).toEqual([true, true, true, false]);
    }));
  });

  it('should error with SSE_TIMEOUT after the configured timeout period', fakeAsync(() => {
    const errors: SseError[] = [];
    service.stream('state', 5000).subscribe({ error: (e: SseError) => errors.push(e) });

    tick(5000);

    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe('SSE_TIMEOUT');
  }));

  it('should close the EventSource when the subscriber unsubscribes', () => {
    const sub = service.stream('state').subscribe();
    const es = MockEventSource.instances[0];

    sub.unsubscribe();

    expect(es.readyState).toBe(2); // CLOSED
  });

  it('should emit failed progress event after heartbeat timeout with no SSE activity', fakeAsync(() => {
    const events: LoginEvent[] = [];
    service.stream('state', 120000).subscribe(e => events.push(e));

    // 'open' starts the 15-second heartbeat timer
    MockEventSource.instances[0].trigger('open');
    tick(15000);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('progress');
    expect(events[0].validationResults).toEqual([true, true, true, false]);
    expect(events[0].errorCode).toBe('LIKELY_REVOKED');
  }));

  it('should reset heartbeat timer when a message event resets activity', fakeAsync(() => {
    const events: LoginEvent[] = [];
    const sub = service.stream('state', 120000).subscribe(e => events.push(e));

    const es = MockEventSource.instances[0];
    es.trigger('open');

    // Activity at 10s — should reset the 15s heartbeat
    tick(10000);
    es.trigger('message', 'ping');
    // Heartbeat was cleared; wait 14s more (24s total).
    // Without reset it would have fired at t=15s; with reset the new 15s window ends at t=25s.
    tick(14000);

    // No heartbeat failure event yet
    expect(events.every(e => e.errorCode !== 'LIKELY_REVOKED')).toBe(true);

    sub.unsubscribe(); // cancel pending timeout + new heartbeat timers
  }));

  describe('redirect event — token exchange', () => {
    const buildIdToken = (claims: Record<string, unknown>): string => {
      const header = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(claims));
      return `${header}.${payload}.signature`;
    };

    beforeEach(() => {
      sessionStorage.setItem('pkce_code_verifier', 'test-verifier');
      sessionStorage.setItem('pkce_state', 'test-state');
    });

    it('should emit progress with all-pass results and user data after successful token exchange', (done) => {
      service.stream('test-state', 120000).subscribe({
        next: e => {
          if (e.type === 'progress') {
            expect(e.validationResults).toEqual([true, true, true, true]);
            expect(e.userData?.['name']).toBe('John Doe');
            expect(e.userData?.['given_name']).toBe('John');
            done();
          }
        }
      });

      MockEventSource.instances[0].trigger(
        'redirect',
        'https://verifier.example.com/callback?code=auth-code&state=test-state'
      );

      // HTTP request is synchronously in httpMock after trigger (firstValueFrom subscribes eagerly)
      const req = httpMock.expectOne(r => r.url.includes('/oidc/token'));
      expect(req.request.method).toBe('POST');
      req.flush({
        id_token: buildIdToken({ name: 'John Doe', given_name: 'John', family_name: 'Doe' })
      });
      // Promise chain resolves on the microtask queue → next callback fires → done()
    });

    it('should send code_verifier in the token request for PKCE validation', fakeAsync(() => {
      service.stream('test-state', 120000).subscribe();

      MockEventSource.instances[0].trigger(
        'redirect',
        'https://verifier.example.com/callback?code=auth-code&state=test-state'
      );

      flushMicrotasks();

      const req = httpMock.expectOne(r => r.url.includes('/oidc/token'));
      expect(req.request.body).toContain('code_verifier=test-verifier');
      expect(req.request.body).toContain('code=auth-code');
      req.flush({ id_token: buildIdToken({ name: 'Test' }) });
      flushMicrotasks();
    }));

    it('should error with TOKEN_EXCHANGE_FAILED when code_verifier is absent from sessionStorage', (done) => {
      sessionStorage.removeItem('pkce_code_verifier');
      service.stream('test-state', 120000).subscribe({
        error: (e: SseError) => {
          expect(e.code).toBe('TOKEN_EXCHANGE_FAILED');
          done();
        }
      });

      MockEventSource.instances[0].trigger(
        'redirect',
        'https://verifier.example.com/callback?code=auth-code&state=test-state'
      );
      // exchangeCodeForTokens throws before HTTP → Promise rejects on microtask queue → done()
    });

    it('should error with TOKEN_EXCHANGE_FAILED when state does not match', (done) => {
      sessionStorage.setItem('pkce_state', 'different-state');
      service.stream('test-state', 120000).subscribe({
        error: (e: SseError) => {
          expect(e.code).toBe('TOKEN_EXCHANGE_FAILED');
          done();
        }
      });

      MockEventSource.instances[0].trigger(
        'redirect',
        'https://verifier.example.com/callback?code=auth-code&state=test-state'
      );
      // State mismatch → exchangeCodeForTokens throws → Promise rejects → done()
    });
  });
});
