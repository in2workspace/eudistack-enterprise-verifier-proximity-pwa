import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { QRDisplayComponent } from './qr-display.component';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';

/**
 * QR Display Component Tests
 * 
 * These tests focus on component logic without rendering (NO detectChanges).
 * Visual QR code rendering is tested in E2E tests to avoid jsdom canvas issues.
 */
describe('QRDisplayComponent (Logic)', () => {
  let component: QRDisplayComponent;
  let fixture: ComponentFixture<QRDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        IonicModule.forRoot(),
        TranslateModule.forRoot(),
        HttpClientTestingModule
      ]
    }).compileComponents();
    
    // Create component instance WITHOUT rendering
    fixture = TestBed.createComponent(QRDisplayComponent);
    component = fixture.componentInstance;
    // NOTE: We do NOT call fixture.detectChanges() to avoid QR Code rendering
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default duration of 120 seconds', () => {
    expect(component.duration()).toBe(120);
  });

  it('should have autoRegenerate enabled by default', () => {
    expect(component.autoRegenerate()).toBe(true);
  });

  it('should format time correctly', () => {
    component['timeRemaining'].set(120);
    expect(component.formattedTime()).toBe('2:00');

    component['timeRemaining'].set(65);
    expect(component.formattedTime()).toBe('1:05');

    component['timeRemaining'].set(5);
    expect(component.formattedTime()).toBe('0:05');

    component['timeRemaining'].set(0);
    expect(component.formattedTime()).toBe('0:00');
  });

  it('should calculate progress correctly',  () => {
    // Set test duration and qrData via fixture input
    fixture.componentRef.setInput('duration', 100);
    fixture.componentRef.setInput('qrData', 'test-qr-data');
    fixture.detectChanges();
    
    component['timeRemaining'].set(100);
    expect(component.progress()).toBe(100);

    component['timeRemaining'].set(50);
    expect(component.progress()).toBe(50);

    component['timeRemaining'].set(25);
    expect(component.progress()).toBe(25);

    component['timeRemaining'].set(0);
    expect(component.progress()).toBe(0);
  });

  it('should show warning when time < 30s', () => {
    component['timeRemaining'].set(35);
    expect(component.isWarning()).toBe(false);

    component['timeRemaining'].set(30);
    expect(component.isWarning()).toBe(false);

    component['timeRemaining'].set(29);
    expect(component.isWarning()).toBe(true);

    component['timeRemaining'].set(10);
    expect(component.isWarning()).toBe(true);

    component['timeRemaining'].set(0);
    expect(component.isWarning()).toBe(true);
  });

  it('should emit regenerate event when manual regeneration requested', (done) => {
    component.regenerate.subscribe(() => {
      expect(true).toBe(true);
      done();
    });

    component.onRegenerate();
  });

  it('should cleanup subscription on destroy', () => {
    // Start a countdown
    component['timeRemaining'].set(5);
    const mockUnsubscribe = jest.fn();
    component['countdownSubscription'] = { unsubscribe: mockUnsubscribe } as any;

    component.ngOnDestroy();
    
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  describe('Lifecycle', () => {
    it('should initialize with loading false', () => {
      expect(component['isLoading']()).toBe(false);
    });

    it('should initialize with expired false', () => {
      expect(component['isExpired']()).toBe(false);
    });
  });
});

