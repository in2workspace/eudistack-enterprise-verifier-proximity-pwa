import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { VerificationPageComponent } from './verification-page.component';
import { VerificationFlowService } from '../../../../core/services/verification-flow.service';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
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
});
