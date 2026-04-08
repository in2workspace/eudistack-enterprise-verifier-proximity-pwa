import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Theme Configuration Interface
 * 
 * Loaded from assets/themes/{tenantId}.theme.json
 */
export interface ThemeConfig {
  tenantId: string;
  branding: {
    name: string;
    primaryColor: string;
    primaryDark?: string;
    secondaryColor: string;
    logoUrl: string;
    logoDarkUrl?: string;
    faviconUrl?: string;
  };
  gradients?: {
    primary: { start: string; end: string; angle: number };
    success?: { start: string; end: string; angle: number };
    error?: { start: string; end: string; angle: number };
  };
  components?: {
    header?: {
      backgroundColor: string;
      textColor: string;
      height: string;
      logoHeight: string;
    };
  };
  content?: {
    links: Array<{ title: string; url: string }>;
    footer: string;
  };
  i18n?: {
    defaultLang: string;
    available: string[];
  };
}

/**
 * Theme Service
 * 
 * Manages multi-tenant theming and branding configuration.
 * Loads theme from assets/themes/{tenantId}.theme.json and applies CSS variables.
 * 
 * @service
 * @injectable
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly http = inject(HttpClient);

  // ── State (signals) ──
  private readonly _theme = signal<ThemeConfig | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ── Public API (computed signals) ──
  
  readonly theme = computed(() => this._theme());
  readonly tenantId = computed(() => this._theme()?.tenantId ?? 'altia');
  readonly brandName = computed(() => this._theme()?.branding.name ?? 'Altia Verification');
  readonly logoUrl = computed(() => this._theme()?.branding.logoUrl ?? 'assets/logos/altia-logo-dark.svg');
  readonly logoDarkUrl = computed(() => this._theme()?.branding.logoDarkUrl);
  readonly primaryColor = computed(() => this._theme()?.branding.primaryColor ?? '#001E8C');
  readonly primaryDark = computed(() => this._theme()?.branding.primaryDark ?? '#001570');
  readonly secondaryColor = computed(() => this._theme()?.branding.secondaryColor ?? '#00ff94');
  readonly headerBackgroundColor = computed(() => this._theme()?.components?.header?.backgroundColor ?? '#ffffff');
  readonly headerTextColor = computed(() => this._theme()?.components?.header?.textColor ?? '#001E8C');
  readonly headerHeight = computed(() => this._theme()?.components?.header?.height ?? '64px');
  readonly headerLogoHeight = computed(() => this._theme()?.components?.header?.logoHeight ?? '40px');
  readonly isLoading = computed(() => this._isLoading());
  readonly error = computed(() => this._error());

  /**
   * Load theme configuration for specific tenant
   * 
   * Falls back to 'kpmg' theme if tenant theme not found.
   * Applies CSS variables to :root element.
   * 
   * @param tenantId - Tenant identifier (default: 'kpmg' from env or URL)
   * @returns Promise<void>
   */
  public async loadTheme(tenantId: string = 'kpmg'): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      console.log(`[ThemeService] Loading theme for tenant: ${tenantId}`);

      // Try tenant-specific theme first
      let themeUrl = `assets/themes/${tenantId}.theme.json`;
      let config: ThemeConfig;

      try {
        config = await firstValueFrom(this.http.get<ThemeConfig>(themeUrl));
      } catch (error) {
        console.warn(`[ThemeService] Theme not found for ${tenantId}, using fallback theme.json`);
        // Fallback to default theme.json if tenant theme doesn't exist
        themeUrl = 'assets/theme.json';
        config = await firstValueFrom(this.http.get<ThemeConfig>(themeUrl));
        config.tenantId = tenantId;
      }

      this._theme.set(config);
      this.applyTheme(config);

      console.log('[ThemeService] Theme loaded successfully:', config.branding.name);
    } catch (error) {
      const errorMessage = `Failed to load theme for tenant: ${tenantId}`;
      console.error('[ThemeService]', errorMessage, error);
      this._error.set(errorMessage);
      
      // Last resort: apply hardcoded KPMG theme
      if (tenantId !== 'kpmg') {
        console.warn('[ThemeService] Falling back to hardcoded KPMG theme');
        this.applyHardcodedKpmgTheme();
      }
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Apply theme configuration by setting CSS variables
   * 
   * @param config Theme configuration
   */
  private applyTheme(config: ThemeConfig): void {
    const root = document.documentElement;

    // ── Brand Colors ──
    root.style.setProperty('--theme-primary', config.branding.primaryColor);
    root.style.setProperty('--theme-primary-dark', config.branding.primaryDark || config.branding.primaryColor);
    root.style.setProperty('--theme-secondary', config.branding.secondaryColor);

    // ── Gradients ──
    if (config.gradients?.primary) {
      const { start, end, angle } = config.gradients.primary;
      root.style.setProperty('--theme-gradient-primary', `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`);
    }

    if (config.gradients?.success) {
      const { start, end, angle } = config.gradients.success;
      root.style.setProperty('--theme-gradient-success', `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`);
    }

    if (config.gradients?.error) {
      const { start, end, angle } = config.gradients.error;
      root.style.setProperty('--theme-gradient-error', `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`);
    }

    // ── Header ──
    if (config.components?.header) {
      root.style.setProperty('--theme-header-bg', config.components.header.backgroundColor);
      root.style.setProperty('--theme-header-text', config.components.header.textColor);
      root.style.setProperty('--theme-header-height', config.components.header.height);
      root.style.setProperty('--theme-header-logo-height', config.components.header.logoHeight);
    }

    // ── Page Title & Favicon ──
    document.title = config.branding.name;
    if (config.branding.faviconUrl) {
      this.updateFavicon(config.branding.faviconUrl);
    }
  }

  /**
   * Apply hardcoded Altia theme as last-resort fallback
   */
  private applyHardcodedKpmgTheme(): void {
    const fallbackTheme: ThemeConfig = {
      tenantId: 'altia',
      branding: {
        name: 'Altia Verification',
        primaryColor: '#001E8C',
        primaryDark: '#001570',
        secondaryColor: '#00ff94',
        logoUrl: 'assets/logos/altia-logo-dark.svg'
      },
      gradients: {
        primary: { start: '#001E8C', end: '#001570', angle: 180 },
        success: { start: '#00ff94', end: '#00cc77', angle: 135 },
        error: { start: '#D32F2F', end: '#B71C1C', angle: 135 }
      },
      components: {
        header: {
          backgroundColor: '#ffffff',
          textColor: '#001E8C',
          height: '64px',
          logoHeight: '40px'
        }
      }
    };

    this._theme.set(fallbackTheme);
    this.applyTheme(fallbackTheme);
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
   * Get primary gradient CSS string
   */
  getPrimaryGradient(): string {
    const theme = this._theme();
    if (!theme?.gradients?.primary) return 'linear-gradient(180deg, #00338D 0%, #002770 100%)';
    
    const { start, end, angle } = theme.gradients.primary;
    return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
  }

  /**
   * Get success gradient CSS string
   */
  getSuccessGradient(): string {
    const theme = this._theme();
    if (!theme?.gradients?.success) return 'linear-gradient(135deg, #00A878 0%, #008C63 100%)';
    
    const { start, end, angle } = theme.gradients.success;
    return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
  }

  /**
   * Get error gradient CSS string
   */
  getErrorGradient(): string {
    const theme = this._theme();
    if (!theme?.gradients?.error) return 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)';
    
    const { start, end, angle } = theme.gradients.error;
    return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
  }

  /**
   * Get footer text with year and brand name interpolated
   */
  getFooterText(): string {
    const config = this._theme();
    if (!config?.content?.footer) {
      return `© ${new Date().getFullYear()} ${this.brandName()}. All rights reserved.`;
    }

    return config.content.footer
      .replace('{year}', new Date().getFullYear().toString())
      .replace('{brandName}', config.branding.name);
  }

  /**
   * Get legal links
   */
  getLegalLinks(): Array<{ title: string; url: string }> {
    return this._theme()?.content?.links || [];
  }
}
