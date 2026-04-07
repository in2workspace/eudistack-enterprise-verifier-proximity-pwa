import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ThemeService, ThemeConfig } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let httpMock: HttpTestingController;

  const mockThemeConfig: ThemeConfig = {
    branding: {
      name: 'Test Brand',
      primaryColor: '#123456',
      primaryContrastColor: '#ffffff',
      secondaryColor: '#654321',
      secondaryContrastColor: '#ffffff',
      logoUrl: 'assets/test-logo.svg',
      logoDarkUrl: 'assets/test-logo-dark.svg',
      faviconUrl: 'assets/test-favicon.png',
      pwaIconUrl: 'assets/test-icon.png'
    },
    content: {
      links: [
        { title: 'Privacy', url: '/privacy' }
      ],
      footer: '© {year} {brandName}. All rights reserved.'
    },
    i18n: {
      defaultLang: 'en',
      available: ['en', 'es']
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ThemeService]
    });

    service = TestBed.inject(ThemeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load theme configuration', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('/assets/theme.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockThemeConfig);

    const result = await loadPromise;
    expect(result).toEqual(mockThemeConfig);
    expect(service.getThemeConfig()).toEqual(mockThemeConfig);
  });

  it('should apply CSS variables when theme is loaded', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('/assets/theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--primary-color')).toBe(mockThemeConfig.branding.primaryColor);
    expect(root.style.getPropertyValue('--secondary-color')).toBe(mockThemeConfig.branding.secondaryColor);
  });

  it('should return brand name', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('/assets/theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    expect(service.getBrandName()).toBe('Test Brand');
  });

  it('should return default brand name when config not loaded', () => {
    expect(service.getBrandName()).toBe('Enterprise Verifier');
  });

  it('should return logo URL', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('/assets/theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    expect(service.getLogoUrl()).toBe('assets/test-logo.svg');
  });

  it('should return footer text with interpolated values', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('/assets/theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    const currentYear = new Date().getFullYear();
    const footerText = service.getFooterText();
    
    expect(footerText).toContain(currentYear.toString());
    expect(footerText).toContain('Test Brand');
  });

  it('should return legal links', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('/assets/theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    const links = service.getLegalLinks();
    expect(links).toEqual(mockThemeConfig.content.links);
  });

  it('should handle theme loading error', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('/assets/theme.json');
    req.error(new ProgressEvent('error'));

    await expect(loadPromise).rejects.toThrow();
  });
});
