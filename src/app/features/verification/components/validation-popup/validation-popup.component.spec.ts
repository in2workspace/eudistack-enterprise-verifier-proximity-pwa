import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';
import { ValidationPopupComponent, CheckStatus } from './validation-popup.component';

describe('ValidationPopupComponent', () => {
  let component: ValidationPopupComponent;
  let fixture: ComponentFixture<ValidationPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ValidationPopupComponent,
        TranslateModule.forRoot(),
        IonicModule.forRoot()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ValidationPopupComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with 4 pending checks', () => {
      expect(component.checks().length).toBe(4);
      expect(component.checks().every(c => c.status === 'pending')).toBe(true);
    });

    it('should have correct check keys', () => {
      const keys = component.checks().map(c => c.key);
      expect(keys).toEqual(['vpSignature', 'vcSignature', 'trustedIssuer', 'notRevoked']);
    });

    it('should initialize state signals correctly', () => {
      expect(component.allSuccess()).toBe(false);
      expect(component.hasError()).toBe(false);
      expect(component.isValidating()).toBe(false);
    });
  });

  describe('Sequential Validation Animation', () => {
    it('should start validation when isOpen is true', fakeAsync(() => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      
      component.ngOnInit();
      
      expect(component.isValidating()).toBe(true);
      
      // Clean up
      tick(5000);
    }));

    it('should validate checks sequentially with 1s delay', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      
      component.startValidation();
      
      // Check 1: Validating after 0s
      expect(component.checks()[0].status).toBe('validating');
      expect(component.checks()[1].status).toBe('pending');
      
      // Check 1: Success after 1s
      tick(1000);
      expect(component.checks()[0].status).toBe('success');
      expect(component.checks()[1].status).toBe('validating');
      
      // Check 2: Success after 2s total
      tick(1000);
      expect(component.checks()[1].status).toBe('success');
      expect(component.checks()[2].status).toBe('validating');
      
      // Check 3: Success after 3s total
      tick(1000);
      expect(component.checks()[2].status).toBe('success');
      expect(component.checks()[3].status).toBe('validating');
      
      // Check 4: Success after 4s total
      tick(1000);
      expect(component.checks()[3].status).toBe('success');
      expect(component.isValidating()).toBe(false);
      expect(component.allSuccess()).toBe(true);
      expect(component.hasError()).toBe(false);
    }));

    it('should stop validation on first error', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, false, true, true]);
      
      component.startValidation();
      
      // Check 1: Success after 1s
      tick(1000);
      expect(component.checks()[0].status).toBe('success');
      
      // Check 2: Error after 2s, stops here
      tick(1000);
      expect(component.checks()[1].status).toBe('error');
      expect(component.checks()[2].status).toBe('pending');
      expect(component.checks()[3].status).toBe('pending');
      expect(component.isValidating()).toBe(false);
      expect(component.hasError()).toBe(true);
      expect(component.allSuccess()).toBe(false);
    }));

    it('should handle error on first check', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [false, true, true, true]);
      
      component.startValidation();
      
      // Check 1: Error after 1s
      tick(1000);
      expect(component.checks()[0].status).toBe('error');
      expect(component.checks()[1].status).toBe('pending');
      expect(component.isValidating()).toBe(false);
      expect(component.hasError()).toBe(true);
    }));
  });

  describe('Icon and Color Methods', () => {
    it('should return correct icon for each status', () => {
      expect(component.getIconName('pending')).toBe('ellipse-outline');
      expect(component.getIconName('validating')).toBe('sync-outline');
      expect(component.getIconName('success')).toBe('checkmark-circle');
      expect(component.getIconName('error')).toBe('close-circle');
    });

    it('should return correct color for each status', () => {
      expect(component.getIconColor('pending')).toBe('medium');
      expect(component.getIconColor('validating')).toBe('primary');
      expect(component.getIconColor('success')).toBe('success');
      expect(component.getIconColor('error')).toBe('danger');
    });
  });

  describe('Button Click Handlers', () => {
    it('should emit okClicked when OK button is clicked', () => {
      const spy = jest.fn();
      component.okClicked.subscribe(spy);
      
      component.onOkClick();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should emit retryClicked when Retry button is clicked', () => {
      const spy = jest.fn();
      component.retryClicked.subscribe(spy);
      
      component.onRetryClick();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should clear timeouts when OK is clicked', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();
      
      // Click OK during validation
      tick(500);
      component.onOkClick();
      
      // Should not continue animating
      tick(1000);
      expect(component.checks()[0].status).toBe('validating');
      expect(component.checks()[1].status).toBe('pending');
    }));

    it('should clear timeouts when Retry is clicked', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();
      
      // Click Retry during validation
      tick(500);
      component.onRetryClick();
      
      // Should not continue animating
      tick(1000);
      expect(component.checks()[0].status).toBe('validating');
      expect(component.checks()[1].status).toBe('pending');
    }));
  });

  describe('Lifecycle', () => {
    it('should clear timeouts on destroy', fakeAsync(() => {
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();
      
      tick(500);
      component.ngOnDestroy();
      
      // Should not continue after destroy
      tick(1000);
      expect(component.checks()[0].status).toBe('validating');
    }));
  });

  describe('Reset Functionality', () => {
    it('should restart validation correctly after completion', fakeAsync(() => {
      // First validation
      fixture.componentRef.setInput('validationResults', [true, true, true, true]);
      component.startValidation();
      tick(4000);
      
      expect(component.checks().every(c => c.status === 'success')).toBe(true);
      expect(component.allSuccess()).toBe(true);
      expect(component.isValidating()).toBe(false);
      
      // Second validation - should work correctly
      fixture.componentRef.setInput('validationResults', [true, false, true, true]);
      component.startValidation();
      
      // Should start from first check
      expect(component.checks()[0].status).toBe('validating');
      expect(component.isValidating()).toBe(true);
      expect(component.allSuccess()).toBe(false);
      
      tick(1000);
      expect(component.checks()[0].status).toBe('success');
      expect(component.checks()[1].status).toBe('validating');
      
      // Second check fails
      tick(1000);
      expect(component.checks()[1].status).toBe('error');
      expect(component.hasError()).toBe(true);
      expect(component.isValidating()).toBe(false);
    }));
  });
});
