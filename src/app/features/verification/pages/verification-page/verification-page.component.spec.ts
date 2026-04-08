import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerificationPageComponent } from './verification-page.component';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { ValidationService } from '../../../../core/services/validation.service';
import { StorageService } from '../../../../core/services/storage.service';
import { VerifierIdentityService } from '../../../../core/services/verifier-identity.service';
import { CryptoService } from '../../../../core/services/crypto.service';
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
        StorageService,
        VerifierIdentityService,
        CryptoService
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
    // client_id should be a did:key (dynamically generated)
    expect(qrUrl).toMatch(/client_id=did%3Akey%3Az[1-9A-HJ-NP-Za-km-z]+/);
    // request parameter contains the JWT (JAR by Value)
    expect(qrUrl).toContain('request=');
    expect(qrUrl).not.toContain('request_uri');
  });
});
