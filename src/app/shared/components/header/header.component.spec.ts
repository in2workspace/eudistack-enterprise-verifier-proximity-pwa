import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { IonicModule } from '@ionic/angular';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default title', () => {
    expect(component.title()).toBe('Verificador de Credenciales');
  });

  it('should show logo by default', () => {
    expect(component.showLogo()).toBe(true);
  });

  it('should render header with ion-toolbar', () => {
    const compiled = fixture.nativeElement;
    const toolbar = compiled.querySelector('ion-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('should render logo when showLogo is true', () => {
    fixture.componentRef.setInput('showLogo', true);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    const logo = compiled.querySelector('.header-logo img');
    expect(logo).toBeTruthy();
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
    const title = compiled.querySelector('ion-title');
    expect(title?.textContent?.trim()).toBe(customTitle);
  });

  it('should have primary color on toolbar', () => {
    const compiled = fixture.nativeElement;
    const toolbar = compiled.querySelector('ion-toolbar');
    expect(toolbar?.getAttribute('color')).toBe('primary');
  });
});
