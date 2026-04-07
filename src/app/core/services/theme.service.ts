import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

/**
 * Theme Configuration Interface
 * 
 * Loaded from assets/theme.json
 */
export interface ThemeConfig {
  branding: {
    name: string;
    primaryColor: string;
    primaryContrastColor: string;
    secondaryColor: string;
    secondaryContrastColor: string;
    logoUrl: string;
    logoDarkUrl: string;
    faviconUrl: string;
    pwaIconUrl: string;
  };
  content: {
    links: Array<{
      title: string;
      url: string;
    }>;
    footer: string;
  };
  i18n: {
    defaultLang: string;
    available: string[];
  };
}

/**
 * Theme Service
 * 
 * Manages application theming and branding configuration.
 * Loads theme from assets/theme.json and applies CSS variables.
 * 
 * @service
 * @injectable
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_CONFIG_PATH = '/assets/theme.json';
  private readonly http = inject(HttpClient);

  private readonly themeConfigSubject = new BehaviorSubject<ThemeConfig | null>(null);
  public readonly themeConfig$: Observable<ThemeConfig | null> = this.themeConfigSubject.asObservable();

  /**
   * Load theme configuration from JSON file
   * 
   * Should be called on app initialization (APP_INITIALIZER).
   * Applies CSS variables to :root element.
   * 
   * @returns Promise<ThemeConfig>
   */
  public async loadTheme(): Promise<ThemeConfig> {
    try {
      console.log('[ThemeService] Loading theme configuration...');

      const config = await firstValueFrom(
        this.http.get<ThemeConfig>(this.THEME_CONFIG_PATH)
      );

      this.themeConfigSubject.next(config);
      this.applyTheme(config);

      console.log('[ThemeService] Theme loaded successfully:', config.branding.name);

      return config;
    } catch (error) {
      console.error('[ThemeService] Failed to load theme:', error);
      throw new Error('Failed to load theme configuration');
    }
  }

  /**
   * Apply theme configuration by setting CSS variables
   * 
   * @param config Theme configuration
   */
  private applyTheme(config: ThemeConfig): void {
    const root = document.documentElement;

    // Apply brand colors
    root.style.setProperty('--primary-color', config.branding.primaryColor);
    root.style.setProperty('--primary-contrast-color', config.branding.primaryContrastColor);
    root.style.setProperty('--secondary-color', config.branding.secondaryColor);
    root.style.setProperty('--secondary-contrast-color', config.branding.secondaryContrastColor);

    // Update page title
    document.title = config.branding.name;

    // Update favicon
    this.updateFavicon(config.branding.faviconUrl);
  }

  /**
   * Update favicon dynamically
   * 
   * @param faviconUrl Favicon URL
   */
  private updateFavicon(faviconUrl: string): void {
    const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = faviconUrl;
    document.getElementsByTagName('head')[0].appendChild(link);
  }

  /**
   * Get current theme configuration
   * 
   * @returns Current theme config or null if not loaded
   */
  public getThemeConfig(): ThemeConfig | null {
    return this.themeConfigSubject.value;
  }

  /**
   * Get brand name
   * 
   * @returns Brand name or 'Enterprise Verifier' as fallback
   */
  public getBrandName(): string {
    return this.themeConfigSubject.value?.branding.name || 'Enterprise Verifier';
  }

  /**
   * Get logo URL (white version for dark backgrounds)
   * 
   * @returns Logo URL
   */
  public getLogoUrl(): string {
    return this.themeConfigSubject.value?.branding.logoUrl || 'assets/images/logo-white.svg';
  }

  /**
   * Get footer text with year and brand name interpolated
   * 
   * @returns Footer text
   */
  public getFooterText(): string {
    const config = this.themeConfigSubject.value;
    if (!config) {
      return `© ${new Date().getFullYear()} Enterprise Verifier. All rights reserved.`;
    }

    return config.content.footer
      .replace('{year}', new Date().getFullYear().toString())
      .replace('{brandName}', config.branding.name);
  }

  /**
   * Get legal links
   * 
   * @returns Array of legal links
   */
  public getLegalLinks(): Array<{ title: string; url: string }> {
    return this.themeConfigSubject.value?.content.links || [];
  }
}
