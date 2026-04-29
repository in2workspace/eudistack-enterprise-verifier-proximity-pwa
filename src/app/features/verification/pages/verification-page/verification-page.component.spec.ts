import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { VerificationPageComponent } from './verification-page.component';
import { VerificationFlowService } from '../../../../core/services/verification-flow.service';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('VerificationPageComponent', () => {
  let component: VerificationPageComponent;
  let fixture: ComponentFixture<VerificationPageComponent>;
  let verificationFlowServiceMock: Partial<VerificationFlowService>;

  beforeEach(async () => {
    // Mock VerificationFlowService
    verificationFlowServiceMock = {
      startVerification: jest.fn().mockReturnValue(of({
        status: 'waiting',
        qrData: {
          uri: 'openid4vp://test',
          sessionId: 'test-session',
          state: 'test-state',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 120000)
        }
      })),
      startFromAuthRequest: jest.fn().mockReturnValue(of({
        status: 'waiting',
        qrData: {
          uri: 'openid4vp://test',
          sessionId: 'test-session',
          state: 'test-state',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 120000)
        }
      })),
      cancelVerification: jest.fn(),
      regenerateQr: jest.fn().mockReturnValue(of({
        status: 'waiting',
        qrData: {
          uri: 'openid4vp://test-new',
          sessionId: 'test-session-new',
          state: 'test-state-new',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 120000)
        }
      }))
    };

    await TestBed.configureTestingModule({
      imports: [
        VerificationPageComponent,
        HttpClientTestingModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideRouter([]),
        { provide: VerificationFlowService, useValue: verificationFlowServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with waiting state', () => {
    expect(component.currentState()).toBe('waiting');
  });

  describe('redirectUrl signal', () => {
    it('should default to "/"', () => {
      expect(component.redirectUrl()).toBe('/');
    });

    it('should be populated from homeUri query param when OAuth2 redirect includes it', () => {
      const route = TestBed.inject(ActivatedRoute);
      Object.defineProperty(route, 'snapshot', {
        value: {
          queryParams: {
            authRequest: 'openid4vp://test-auth-request',
            state: 'test-state-123',
            homeUri: 'https://proximity.example.com/home'
          }
        },
        configurable: true
      });

      component.ngOnInit();

      expect(component.redirectUrl()).toBe('https://proximity.example.com/home');
    });

    it('should keep "/" when homeUri is absent from OAuth2 redirect', () => {
      const route = TestBed.inject(ActivatedRoute);
      Object.defineProperty(route, 'snapshot', {
        value: {
          queryParams: {
            authRequest: 'openid4vp://test-auth-request',
            state: 'test-state-123'
          }
        },
        configurable: true
      });

      component.ngOnInit();

      expect(component.redirectUrl()).toBe('/');
    });
  });
});
