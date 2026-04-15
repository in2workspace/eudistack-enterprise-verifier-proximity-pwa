import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ThemeService } from './theme.service';
import { ThemeConfig } from '../models/theme.model';

describe('ThemeService', () => {
  let service: ThemeService;
  let httpMock: HttpTestingController;

  const mockThemeConfig: ThemeConfig = {
    tenantId: 'test-tenant',
    branding: {
      name: 'Test Brand',
      primaryColor: '#123456',
      primaryDark: '#0a1a2a',
      secondaryColor: '#654321',
      logoUrl: 'assets/test-logo.svg',
      logoDarkUrl: 'assets/test-logo-dark.svg',
      faviconUrl: 'assets/test-favicon.png'
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
    const loadPromise = service.loadTheme('test-tenant');

    const req = httpMock.expectOne('assets/themes/test-tenant.theme.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockThemeConfig);

    await loadPromise;
    expect(service.theme()).toEqual(mockThemeConfig);
  });

  it('should apply CSS variables when theme is loaded', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('assets/themes/altia.theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--theme-primary')).toBe(mockThemeConfig.branding.primaryColor);
    expect(root.style.getPropertyValue('--theme-secondary')).toBe(mockThemeConfig.branding.secondaryColor);
  });

  it('should return brand name', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('assets/themes/altia.theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    expect(service.theme()?.branding.name).toBe('Test Brand');
  });

  it('should return logo URL', async () => {
    const loadPromise = service.loadTheme();

    const req = httpMock.expectOne('assets/themes/altia.theme.json');
    req.flush(mockThemeConfig);

    await loadPromise;

    expect(service.logoUrl()).toBe('assets/test-logo.svg');
  });


  it('should handle theme loading error and use fallback', async () => {
    const loadPromise = service.loadTheme();

    // First request fails (tenant-specific theme)
    const req1 = httpMock.expectOne('assets/themes/altia.theme.json');
    req1.error(new ProgressEvent('error'));

    // Wait for async catch block to execute and make second request
    await new Promise(resolve => setTimeout(resolve, 0));

    // Second request succeeds (fallback theme.json)
    const req2 = httpMock.expectOne('assets/theme.json');
    req2.flush(mockThemeConfig);

    await loadPromise;

    // Service should have loaded the fallback theme
    expect(service.theme()?.branding.name).toBe(mockThemeConfig.branding.name);
  });
});
