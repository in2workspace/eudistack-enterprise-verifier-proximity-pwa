import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { IonicModule } from '@ionic/angular';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { signal } from '@angular/core';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let themeServiceMock: Partial<ThemeService>;

  beforeEach(async () => {
    themeServiceMock = {
      logoUrl: signal('assets/test-logo.svg')
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent, IonicModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ThemeService, useValue: themeServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have no title input by default', () => {
    expect(component.title()).toBeNull();
  });

  it('should show logo by default', () => {
    expect(component.showLogo()).toBe(true);
  });

  it('should render header with ion-header', () => {
    const compiled = fixture.nativeElement;
    const header = compiled.querySelector('ion-header');
    expect(header).toBeTruthy();
  });

  it('should render logo when showLogo is true', () => {
    fixture.componentRef.setInput('showLogo', true);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    const logo = compiled.querySelector('.header-logo img');
    expect(logo).toBeTruthy();
    expect(logo.getAttribute('src')).toBe('assets/test-logo.svg');
  });

  it('should not render logo when showLogo is false', () => {
    fixture.componentRef.setInput('showLogo', false);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    const logo = compiled.querySelector('.header-logo');
    expect(logo).toBeFalsy();
  });

  it('should use title as logo alt text', () => {
    const customTitle = 'Custom Title';
    fixture.componentRef.setInput('title', customTitle);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const logo = compiled.querySelector('.header-logo img');
    expect(logo?.getAttribute('alt')).toBe(customTitle);
  });
});
