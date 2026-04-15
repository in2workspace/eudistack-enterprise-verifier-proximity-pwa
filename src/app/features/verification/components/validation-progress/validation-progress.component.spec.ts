import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ThemeService } from '../../../../core/services/theme.service';
import { ValidationProgressComponent, CheckStatus } from './validation-progress.component';

// Animation timings (must mirror the constants inside startValidation()).
const CHECK_DURATION = 1000;
const VIEW_DELAY = 900;
const AUTO_ADVANCE_DELAY = 1200;
const ERROR_REDIRECT_DELAY = 1600;

describe('ValidationProgressComponent', () => {
  let component: ValidationProgressComponent;
  let fixture: ComponentFixture<ValidationProgressComponent>;

  const themeServiceMock: Partial<ThemeService> = {
    logoUrl: signal('assets/test-logo.svg')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ValidationProgressComponent,
        IonicModule.forRoot(),
        TranslateModule.forRoot()
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ThemeService, useValue: themeServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ValidationProgressComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  // ── Initialization ──────────────────────────────────────────────────────────

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with 4 pending checks', () => {
      expect(component.checks().length).toBe(4);
      expect(component.checks().every(c => c.status === 'pending')).toBe(true);
    });

    it('should have the correct check keys in order', () => {
      const keys = component.checks().map(c => c.key);
      expect(keys).toEqual(['vpSignature', 'vcSignature', 'trustedIssuer', 'notRevoked']);
    });

    it('should initialize all state signals to their default values', () => {
      expect(component.allSuccess()).toBe(false);
      expect(component.hasError()).toBe(false);
      expect(component.isValidating()).toBe(false);
      expect(component.isRevocationError()).toBe(false);
    });

    it('should default isOpen to false', () => {
      expect(component.isOpen()).toBe(false);
    });
  });

  // ── progressPercentage (continuous rAF ramp) ────────────────────────────────
  //
  // The ramp is driven by requestAnimationFrame + performance.now(), which fakeAsync
  // doesn't reliably virtualize. We only assert start/end sentinel values; exact
  // mid-animation values are not deterministic under fakeAsync.

  describe('progressPercentage', () => {
    it('should start at 0 before any validation runs', () => {
      expect(component.progressPercentage()).toBe(0);
    });

    it('should be reset to 0 when startValidation is called', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();
      expect(component.progressPercentage()).toBe(0);

      // drain all timers
      tick(4 * CHECK_DURATION + VIEW_DELAY + AUTO_ADVANCE_DELAY);
    }));
  });

  // ── Sequential animation ────────────────────────────────────────────────────

  describe('Sequential Validation Animation', () => {
    it('should set isValidating to true when startValidation is called', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();

      expect(component.isValidating()).toBe(true);

      tick(4 * CHECK_DURATION + VIEW_DELAY + AUTO_ADVANCE_DELAY);
    }));

    it('should animate checks sequentially with CHECK_DURATION between each', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();

      expect(component.checks()[0].status).toBe('validating');
      expect(component.checks()[1].status).toBe('pending');

      tick(CHECK_DURATION);
      expect(component.checks()[0].status).toBe('success');
      expect(component.checks()[1].status).toBe('validating');

      tick(CHECK_DURATION);
      expect(component.checks()[1].status).toBe('success');
      expect(component.checks()[2].status).toBe('validating');

      tick(CHECK_DURATION);
      expect(component.checks()[2].status).toBe('success');
      expect(component.checks()[3].status).toBe('validating');

      tick(CHECK_DURATION);
      expect(component.checks()[3].status).toBe('success');

      tick(VIEW_DELAY + AUTO_ADVANCE_DELAY);
    }));

    it('should flip to success state immediately after the last check resolves', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();

      tick(4 * CHECK_DURATION);
      expect(component.allSuccess()).toBe(true);
      expect(component.isValidating()).toBe(false);
      expect(component.hasError()).toBe(false);

      tick(VIEW_DELAY + AUTO_ADVANCE_DELAY);
    }));

    it('should auto-emit okClicked after VIEW_DELAY + AUTO_ADVANCE_DELAY on full success', fakeAsync(() => {
      const spy = jest.fn();
      component.okClicked.subscribe(spy);

      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();

      tick(4 * CHECK_DURATION);
      expect(spy).not.toHaveBeenCalled();

      tick(VIEW_DELAY + AUTO_ADVANCE_DELAY - 1);
      expect(spy).not.toHaveBeenCalled();

      tick(1);
      expect(spy).toHaveBeenCalledTimes(1);
    }));

    it('should stop on first error and set hasError', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, false, true, true]);
      component.startValidation();

      tick(CHECK_DURATION); // check[0] success
      tick(CHECK_DURATION); // check[1] error

      expect(component.checks()[1].status).toBe('error');
      expect(component.checks()[2].status).toBe('pending');
      expect(component.checks()[3].status).toBe('pending');
      expect(component.hasError()).toBe(true);
      expect(component.isValidating()).toBe(false);
      expect(component.allSuccess()).toBe(false);
    }));

    it('should handle error on the very first check', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [false, true, true, true]);
      component.startValidation();

      tick(CHECK_DURATION);
      expect(component.checks()[0].status).toBe('error');
      expect(component.checks()[1].status).toBe('pending');
      expect(component.hasError()).toBe(true);
      expect(component.isValidating()).toBe(false);
    }));
  });

  // ── Revocation (index 3) ────────────────────────────────────────────────────

  describe('Revocation error (notRevoked check at index 3)', () => {
    it('should set isRevocationError when index 3 fails', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, false]);
      component.startValidation();

      tick(4 * CHECK_DURATION); // reaches check[3] which fails

      expect(component.isRevocationError()).toBe(true);
      expect(component.hasError()).toBe(true);
      expect(component.isValidating()).toBe(false);

      tick(ERROR_REDIRECT_DELAY); // drain auto-redirect
    }));

    it('should NOT set isRevocationError for non-revocation errors', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, false, true, true]);
      component.startValidation();

      tick(2 * CHECK_DURATION); // check[1] fails

      expect(component.isRevocationError()).toBe(false);
      expect(component.hasError()).toBe(true);
    }));

    it('should auto-emit retryClicked after ERROR_REDIRECT_DELAY on revocation failure', fakeAsync(() => {
      const spy = jest.fn();
      component.retryClicked.subscribe(spy);

      fixture.componentRef.setInput('validationResults', [true, true, true, false]);
      component.startValidation();

      tick(4 * CHECK_DURATION); // check[3] fails
      expect(spy).not.toHaveBeenCalled();

      tick(ERROR_REDIRECT_DELAY);
      expect(spy).toHaveBeenCalledTimes(1);
    }));

    it('should NOT auto-emit retryClicked for non-revocation errors', fakeAsync(() => {
      const spy = jest.fn();
      component.retryClicked.subscribe(spy);

      fixture.componentRef.setInput('validationResults', [true, false, true, true]);
      component.startValidation();

      tick(2 * CHECK_DURATION + 5000); // check[1] fails, extra wait
      expect(spy).not.toHaveBeenCalled();
    }));
  });

  // ── Icon and color helpers ──────────────────────────────────────────────────

  describe('getIconName', () => {
    it('should return ellipse-outline for pending', () => {
      expect(component.getIconName('pending')).toBe('ellipse-outline');
    });

    it('should return sync-outline for validating', () => {
      expect(component.getIconName('validating')).toBe('sync-outline');
    });

    it('should return checkmark-circle for success', () => {
      expect(component.getIconName('success')).toBe('checkmark-circle');
    });

    it('should return close-circle for error', () => {
      expect(component.getIconName('error')).toBe('close-circle');
    });

    it('should return ellipse-outline for unknown status', () => {
      expect(component.getIconName('unknown' as CheckStatus)).toBe('ellipse-outline');
    });
  });

  describe('getIconColor', () => {
    it('should return medium for pending', () => {
      expect(component.getIconColor('pending')).toBe('medium');
    });

    it('should return primary for validating', () => {
      expect(component.getIconColor('validating')).toBe('primary');
    });

    it('should return success for success', () => {
      expect(component.getIconColor('success')).toBe('success');
    });

    it('should return danger for error', () => {
      expect(component.getIconColor('error')).toBe('danger');
    });
  });

  // ── Button handlers ─────────────────────────────────────────────────────────

  describe('Button Click Handlers', () => {
    it('should emit okClicked when onOkClick is called', () => {
      const spy = jest.fn();
      component.okClicked.subscribe(spy);

      component.onOkClick();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit retryClicked when onRetryClick is called', () => {
      const spy = jest.fn();
      component.retryClicked.subscribe(spy);

      component.onRetryClick();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should cancel animation when OK is clicked mid-validation', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();

      tick(CHECK_DURATION / 2);
      component.onOkClick(); // clears pending timeouts

      tick(CHECK_DURATION); // would have moved to check[1] but timers are cleared
      expect(component.checks()[0].status).toBe('validating');
      expect(component.checks()[1].status).toBe('pending');
    }));

    it('should cancel animation when Retry is clicked mid-validation', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();

      tick(CHECK_DURATION / 2);
      component.onRetryClick();

      tick(CHECK_DURATION);
      expect(component.checks()[0].status).toBe('validating');
      expect(component.checks()[1].status).toBe('pending');
    }));
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  describe('Lifecycle', () => {
    it('should start validation on init when isOpen is true', fakeAsync(() => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);

      component.ngOnInit();

      expect(component.isValidating()).toBe(true);

      tick(4 * CHECK_DURATION + VIEW_DELAY + AUTO_ADVANCE_DELAY);
    }));

    it('should NOT start validation on init when isOpen is false', () => {
      fixture.componentRef.setInput('isOpen', false);
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);

      component.ngOnInit();

      expect(component.isValidating()).toBe(false);
    });

    it('should clear all timeouts on destroy', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();

      tick(CHECK_DURATION / 2);
      component.ngOnDestroy();

      tick(CHECK_DURATION);
      expect(component.checks()[0].status).toBe('validating'); // frozen at destroy state
    }));
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  describe('Reset and restart', () => {
    it('should reset all checks and signals when startValidation is called again', fakeAsync(() => {
      // First run — all pass
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();
      tick(4 * CHECK_DURATION + VIEW_DELAY + AUTO_ADVANCE_DELAY);

      expect(component.allSuccess()).toBe(true);

      // Second run — first check fails
      fixture.componentRef.setInput('validationResults', [false, true, true, true]);
      component.startValidation();

      expect(component.checks().every(c => c.status === 'validating' || c.status === 'pending')).toBe(true);
      expect(component.allSuccess()).toBe(false);
      expect(component.isValidating()).toBe(true);
      expect(component.isRevocationError()).toBe(false);

      tick(CHECK_DURATION); // check[0] fails → stops
      expect(component.checks()[0].status).toBe('error');
      expect(component.hasError()).toBe(true);
    }));
  });
});
