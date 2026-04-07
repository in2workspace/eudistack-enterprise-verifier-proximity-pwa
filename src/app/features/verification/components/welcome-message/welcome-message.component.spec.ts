import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';
import { WelcomeMessageComponent } from './welcome-message.component';

describe('WelcomeMessageComponent', () => {
  let component: WelcomeMessageComponent;
  let fixture: ComponentFixture<WelcomeMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        WelcomeMessageComponent,
        TranslateModule.forRoot(),
        IonicModule.forRoot()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeMessageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default countdown duration', () => {
      component.ngOnInit();
      expect(component.secondsRemaining()).toBe(10);
    });

    it('should initialize with custom countdown duration', () => {
      fixture.componentRef.setInput('countdownDuration', 5);
      component.ngOnInit();
      expect(component.secondsRemaining()).toBe(5);
    });

    it('should start countdown automatically when autoRedirect is true', fakeAsync(() => {
      fixture.componentRef.setInput('autoRedirect', true);
      fixture.componentRef.setInput('countdownDuration', 3);
      
      component.ngOnInit();
      expect(component.isCountingDown()).toBe(true);
      
      tick(4000);
      component.ngOnDestroy();
    }));

    it('should not start countdown when autoRedirect is false', fakeAsync(() => {
      fixture.componentRef.setInput('autoRedirect', false);
      
      component.ngOnInit();
      expect(component.isCountingDown()).toBe(false);
      
      tick(2000);
      expect(component.secondsRemaining()).toBe(10);
    }));
  });

  describe('Full Name Computed', () => {
    it('should compute full name from firstName and familyName', () => {
      fixture.componentRef.setInput('firstName', 'John');
      fixture.componentRef.setInput('familyName', 'Doe');
      
      expect(component.fullName()).toBe('John Doe');
    });

    it('should handle empty firstName', () => {
      fixture.componentRef.setInput('firstName', '');
      fixture.componentRef.setInput('familyName', 'Doe');
      
      expect(component.fullName()).toBe('Doe');
    });

    it('should handle empty familyName', () => {
      fixture.componentRef.setInput('firstName', 'John');
      fixture.componentRef.setInput('familyName', '');
      
      expect(component.fullName()).toBe('John');
    });

    it('should return "User" when both names are empty', () => {
      fixture.componentRef.setInput('firstName', '');
      fixture.componentRef.setInput('familyName', '');
      
      expect(component.fullName()).toBe('User');
    });

    it('should trim outer whitespace', () => {
      fixture.componentRef.setInput('firstName', '  John');
      fixture.componentRef.setInput('familyName', 'Doe  ');
      
      const result = component.fullName();
      expect(result.startsWith(' ')).toBe(false);
      expect(result.endsWith(' ')).toBe(false);
      expect(result).toContain('John');
      expect(result).toContain('Doe');
    });
  });

  describe('Countdown Functionality', () => {
    it('should count down from initial value', fakeAsync(() => {
      fixture.componentRef.setInput('countdownDuration', 5);
      fixture.componentRef.setInput('autoRedirect', true);
      
      component.ngOnInit();
      
      expect(component.secondsRemaining()).toBe(5);
      tick(1000);
      expect(component.secondsRemaining()).toBe(4);
      tick(1000);
      expect(component.secondsRemaining()).toBe(3);
      tick(1000);
      expect(component.secondsRemaining()).toBe(2);
      tick(1000);
      expect(component.secondsRemaining()).toBe(1);
      tick(1000);
      expect(component.secondsRemaining()).toBe(0);
      
      tick(1000);
      component.ngOnDestroy();
    }));

    it('should emit countdownComplete when countdown finishes', fakeAsync(() => {
      const spy = jest.fn();
      component.countdownComplete.subscribe(spy);
      
      fixture.componentRef.setInput('countdownDuration', 2);
      fixture.componentRef.setInput('autoRedirect', true);
      
      component.ngOnInit();
      
      // Wait for countdown: 2000ms for countdown + 1000ms for interval to detect completion
      tick(3000);
      
      expect(spy).toHaveBeenCalled();
      
      tick(100);
    }));

    it('should stop counting after reaching zero', fakeAsync(() => {
      fixture.componentRef.setInput('countdownDuration', 2);
      fixture.componentRef.setInput('autoRedirect', true);
      
      component.ngOnInit();
      
      tick(2000);
      expect(component.secondsRemaining()).toBe(0);
      expect(component.isCountingDown()).toBe(false);
      
      tick(2000);
      expect(component.secondsRemaining()).toBe(0);
    }));
  });

  describe('Continue Button', () => {
    it('should emit continueClicked when button is clicked', () => {
      const spy = jest.fn();
      component.continueClicked.subscribe(spy);
      
      component.onContinueClick();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should stop countdown when button is clicked', fakeAsync(() => {
      fixture.componentRef.setInput('countdownDuration', 5);
      fixture.componentRef.setInput('autoRedirect', true);
      
      component.ngOnInit();
      expect(component.isCountingDown()).toBe(true);
      
      tick(2000);
      expect(component.secondsRemaining()).toBe(3);
      
      component.onContinueClick();
      expect(component.isCountingDown()).toBe(false);
      
      tick(3000);
      expect(component.secondsRemaining()).toBe(3);
    }));
  });

  describe('Lifecycle', () => {
    it('should clean up subscription on destroy', fakeAsync(() => {
      fixture.componentRef.setInput('countdownDuration', 5);
      fixture.componentRef.setInput('autoRedirect', true);
      
      component.ngOnInit();
      tick(2000);
      
      component.ngOnDestroy();
      expect(component.isCountingDown()).toBe(false);
      
      const secondsBeforeDestroy = component.secondsRemaining();
      tick(3000);
      expect(component.secondsRemaining()).toBe(secondsBeforeDestroy);
    }));
  });

  describe('Redirect Behavior', () => {
    it('should not redirect when autoRedirect is false', fakeAsync(() => {
      fixture.componentRef.setInput('autoRedirect', false);
      fixture.componentRef.setInput('countdownDuration', 1);
      
      const originalHref = window.location.href;
      
      component.ngOnInit();
      tick(2000);
      
      expect(window.location.href).toBe(originalHref);
    }));
  });

  describe('Input Configuration', () => {
    it('should accept custom redirect URL', () => {
      fixture.componentRef.setInput('redirectUrl', '/custom-page');
      expect(component.redirectUrl()).toBe('/custom-page');
    });

    it('should default to "/" for redirect URL', () => {
      expect(component.redirectUrl()).toBe('/');
    });

    it('should respect autoRedirect input', () => {
      fixture.componentRef.setInput('autoRedirect', false);
      expect(component.autoRedirect()).toBe(false);
      
      fixture.componentRef.setInput('autoRedirect', true);
      expect(component.autoRedirect()).toBe(true);
    });
  });
});
