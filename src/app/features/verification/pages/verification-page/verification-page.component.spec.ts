import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { VerificationPageComponent } from './verification-page.component';
import { ValidationService } from '../../../../core/services/validation.service';
import { VerifierIdentityService } from '../../../../core/services/verifier-identity.service';
import { CryptoService } from '../../../../core/services/crypto.service';
import { TrustFrameworkService } from '../../../../core/services/trust-framework.service';
import { StatusListService } from '../../../../core/services/status-list.service';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { of } from 'rxjs';

describe('VerificationPageComponent', () => {
  let component: VerificationPageComponent;
  let fixture: ComponentFixture<VerificationPageComponent>;

  // Mock NgxIndexedDBService
  const mockIndexedDBService = {
    getByKey: jest.fn().mockReturnValue(of(null)),
    add: jest.fn().mockReturnValue(of(1)),
    update: jest.fn().mockReturnValue(of(1)),
    delete: jest.fn().mockReturnValue(of(true)),
    clear: jest.fn().mockReturnValue(of(true))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        VerificationPageComponent,
        HttpClientTestingModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideRouter([]),
        ValidationService,
        VerifierIdentityService,
        CryptoService,
        TrustFrameworkService,
        StatusListService,
        { provide: NgxIndexedDBService, useValue: mockIndexedDBService }
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
