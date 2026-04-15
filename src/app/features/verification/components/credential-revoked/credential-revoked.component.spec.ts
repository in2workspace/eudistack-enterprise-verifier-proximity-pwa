import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ThemeService } from '../../../../core/services/theme.service';
import { CredentialRevokedComponent } from './credential-revoked.component';

describe('CredentialRevokedComponent', () => {
  let component: CredentialRevokedComponent;
  let fixture: ComponentFixture<CredentialRevokedComponent>;

  const themeServiceMock: Partial<ThemeService> = {
    logoUrl: signal('assets/test-logo.svg')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CredentialRevokedComponent,
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

    fixture = TestBed.createComponent(CredentialRevokedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inputs', () => {
    it('should default isOpen to false', () => {
      expect(component.isOpen()).toBe(false);
    });

    it('should reflect the isOpen signal value', () => {
      // Default is false — modal is closed
      expect(component.isOpen()).toBe(false);
    });
  });

  describe('onTryAgainClick', () => {
    it('should emit tryAgainClicked when called', () => {
      const spy = jest.fn();
      component.tryAgainClicked.subscribe(spy);

      component.onTryAgainClick();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit tryAgainClicked on each call', () => {
      const spy = jest.fn();
      component.tryAgainClicked.subscribe(spy);

      component.onTryAgainClick();
      component.onTryAgainClick();

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should not emit tryAgainClicked before it is called', () => {
      const spy = jest.fn();
      component.tryAgainClicked.subscribe(spy);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Modal element', () => {
    it('should render an ion-modal element in the template', () => {
      const modal = fixture.nativeElement.querySelector('ion-modal');
      expect(modal).toBeTruthy();
    });
  });
});
