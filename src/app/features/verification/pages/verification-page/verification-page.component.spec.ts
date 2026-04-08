import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerificationPageComponent } from './verification-page.component';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { ValidationService } from '../../../../core/services/validation.service';
import { StorageService } from '../../../../core/services/storage.service';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';

describe('VerificationPageComponent', () => {
  let component: VerificationPageComponent;
  let fixture: ComponentFixture<VerificationPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        VerificationPageComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        provideRouter([]),
        SessionStateService,
        ValidationService,
        StorageService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize in INITIALIZING state', () => {
    expect(component.currentState()).toBe('initializing');
  });

  it('should have a QR code URL when session is created', async () => {
    await component.ngOnInit();
    
    // Wait for session creation
    await new Promise(resolve => setTimeout(resolve, 100));

    const qrUrl = component.qrCodeUrl();
    expect(qrUrl).toContain('openid4vp://');
    expect(qrUrl).toContain('client_id=kpmg-verifier');
  });
});
