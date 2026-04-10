import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { IonicModule } from '@ionic/angular';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ThemeService } from '../../../core/services/theme.service';
import { signal } from '@angular/core';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let themeServiceMock: Partial<ThemeService>;

  beforeEach(async () => {
    themeServiceMock = {
      brandName: signal('Test Brand'),
      logoUrl: signal('assets/test-logo.svg')
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent, IonicModule.forRoot(), HttpClientTestingModule],
      providers: [
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

  it('should have default title from theme service', () => {
    // Default title comes from ThemeService.brandName() when no input title is set
    expect(component.title()).toBeNull();
    expect(component.effectiveTitle).toBe('Test Brand');
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

  it('should render custom title', () => {
    const customTitle = 'Custom Title';
    fixture.componentRef.setInput('title', customTitle);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    const title = compiled.querySelector('.header-title');
    expect(title?.textContent?.trim()).toBe(customTitle);
  });
});
