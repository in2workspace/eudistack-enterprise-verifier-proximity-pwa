import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ThemeConfig } from '../models/theme.model';

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

  // ── Public API (computed signals) ──

  public readonly theme = computed(() => this._theme());
  // Support both verifier schema (tenantId) and platform standard schema (tenantDomain)
  public readonly tenantId = computed(() => {
    const t = this._theme();
    return t?.tenantId ?? t?.tenantDomain?.toLowerCase() ?? 'altia';
  });
  public readonly logoUrl = computed(() => this._theme()?.branding.logoUrl ?? 'assets/logos/altia-logo-dark.svg');
  public readonly logoDarkUrl = computed(() => this._theme()?.branding.logoDarkUrl);
  public readonly primaryColor = computed(() => this._theme()?.branding.primaryColor ?? '#001E8C');
  public readonly primaryDark = computed(() => {
    const t = this._theme();
    return t?.branding?.primaryDark ?? t?.branding?.auth?.gradientEnd ?? '#001570';
  });
  public readonly secondaryColor = computed(() => this._theme()?.branding.secondaryColor ?? '#00ff94');
  public readonly headerBackgroundColor = computed(() => this._theme()?.components?.header?.backgroundColor ?? '#ffffff');
  public readonly headerTextColor = computed(() => {
    const t = this._theme();
    return t?.components?.header?.textColor ?? t?.branding?.primaryColor ?? '#001E8C';
  });
  public readonly headerHeight = computed(() => this._theme()?.components?.header?.height ?? '64px');
  public readonly headerLogoHeight = computed(() => this._theme()?.components?.header?.logoHeight ?? '40px');
  public readonly isLoading = computed(() => this._isLoading());
  public readonly error = computed(() => this._error());

  // ── State (signals) ──
  private readonly _theme = signal<ThemeConfig | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  
  private readonly http = inject(HttpClient);
  /**
   * Load theme configuration for specific tenant
   * 
   * Falls back to 'altia' theme if tenant theme not found.
   * Applies CSS variables to :root element.
   * 
   * @param tenantId - Tenant identifier (default: 'altia' from env or URL)
   * @returns Promise<void>
   */
  public async loadTheme(tenantId: string = 'altia'): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    const resolvedTenant = this.stripEnvSuffix(tenantId);
    const tryTenants = resolvedTenant === 'altia' ? [resolvedTenant] : [resolvedTenant, 'altia'];

    try {
      let config: ThemeConfig | null = null;
      let loadedFrom: string | null = null;

      for (const candidate of tryTenants) {
        const themeUrl = `/assets/tenants/${candidate}/theme.json`;
        try {
          console.log(`[ThemeService] Loading theme for tenant: ${candidate}`);
          config = await firstValueFrom(this.http.get<ThemeConfig>(themeUrl));
          loadedFrom = candidate;
          this.rewriteAssetPaths(config, `/assets/tenants/${candidate}`);
          break;
        } catch {
          console.warn(`[ThemeService] Theme not found at ${themeUrl}, falling back`);
        }
      }

      if (!config) {
        throw new Error(`Theme not found for tenant ${resolvedTenant}`);
      }

      if (!config.tenantId) {
        config.tenantId = config.tenantDomain?.toLowerCase() ?? loadedFrom ?? resolvedTenant;
      }

      this._theme.set(config);
      this.applyTheme(config);

      console.log('[ThemeService] Theme loaded successfully:', config.branding.name);
    } catch (error) {
      const errorMessage = `Failed to load theme for tenant: ${resolvedTenant}`;
      console.error('[ThemeService]', errorMessage, error);
      this._error.set(errorMessage);

      // Last resort: apply hardcoded Altia theme
      if (resolvedTenant !== 'altia') {
        console.warn('[ThemeService] Falling back to hardcoded Altia theme');
        this.applyHardcodedAltiaTheme();
      }
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Strip environment suffix (-stg/-dev/-pre) from a tenant identifier coming from
   * hostname split, so "sandbox-stg" resolves to "sandbox".
   */
  private stripEnvSuffix(tenant: string): string {
    const suffixes = ['-stg', '-dev', '-pre'];
    const lower = tenant.toLowerCase();
    const match = suffixes.find((s) => lower.endsWith(s));
    return match ? lower.slice(0, -match.length) : lower;
  }

  /**
   * Rewrite legacy per-tenant paths (assets/tenant/x or /assets/tenant/x) to the
   * shared-bucket layout (/assets/tenants/<tenant>/x).
   */
  private rewriteAssetPaths(config: ThemeConfig, assetsBase: string): void {
    const rewrite = (path: string | null | undefined): string | null | undefined => {
      if (!path) return path;
      if (path.startsWith('/assets/tenants/')) return path;
      const normalized = path.startsWith('/') ? path.slice(1) : path;
      if (normalized.startsWith('assets/tenant/')) {
        return `${assetsBase}/${normalized.slice('assets/tenant/'.length)}`;
      }
      return path;
    };
    if (config.branding) {
      config.branding.logoUrl = rewrite(config.branding.logoUrl) ?? config.branding.logoUrl;
      config.branding.logoDarkUrl = rewrite(config.branding.logoDarkUrl) ?? config.branding.logoDarkUrl;
      config.branding.faviconUrl = rewrite(config.branding.faviconUrl) ?? config.branding.faviconUrl;
    }
  }

  /**
   * Get primary gradient CSS string.
   * Supports both verifier schema (gradients.primary) and standard schema (branding.auth).
   */
  public getPrimaryGradient(): string {
    const theme = this._theme();
    if (theme?.gradients?.primary) {
      const { start, end, angle } = theme.gradients.primary;
      return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
    }
    if (theme?.branding?.auth?.background && theme?.branding?.auth?.gradientEnd) {
      return `linear-gradient(135deg, ${theme.branding.auth.background} 0%, ${theme.branding.auth.gradientEnd} 100%)`;
    }
    return 'linear-gradient(180deg, #00338D 0%, #002770 100%)';
  }

  /**
   * Get success gradient CSS string
   */
  public getSuccessGradient(): string {
    const theme = this._theme();
    if (!theme?.gradients?.success) return 'linear-gradient(135deg, #00A878 0%, #008C63 100%)';
    
    const { start, end, angle } = theme.gradients.success;
    return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
  }

  /**
   * Get error gradient CSS string
   */
  public getErrorGradient(): string {
    const theme = this._theme();
    if (!theme?.gradients?.error) return 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)';
    
    const { start, end, angle } = theme.gradients.error;
    return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
  }

  /**
   * Apply theme configuration by setting CSS variables.
   * Supports both the verifier-specific schema (gradients, components.header)
   * and the standard platform schema (branding.auth, branding.primaryContrastColor).
   *
   * @param config Theme configuration
   */
  private applyTheme(config: ThemeConfig): void {
    const root = document.documentElement;

    // ── Brand Colors ──
    // primaryDark: verifier schema → branding.primaryDark | standard schema → branding.auth.gradientEnd
    const primaryDark = config.branding.primaryDark ?? config.branding.auth?.gradientEnd ?? config.branding.primaryColor;
    root.style.setProperty('--theme-primary', config.branding.primaryColor);
    root.style.setProperty('--theme-primary-dark', primaryDark);
    root.style.setProperty('--theme-secondary', config.branding.secondaryColor);

    // ── Gradients ──
    // Priority: explicit gradients block (verifier schema) → branding.auth colors (standard schema)
    const authBg = config.branding.auth?.background;
    const authEnd = config.branding.auth?.gradientEnd;

    if (config.gradients?.primary) {
      const { start, end, angle } = config.gradients.primary;
      root.style.setProperty('--theme-gradient-primary', `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`);
      root.style.setProperty('--theme-gradient-vertical', `linear-gradient(180deg, ${start} 0%, ${end} 100%)`);
    } else if (authBg && authEnd) {
      root.style.setProperty('--theme-gradient-primary', `linear-gradient(135deg, ${authBg} 0%, ${authEnd} 100%)`);
      root.style.setProperty('--theme-gradient-vertical', `linear-gradient(180deg, ${authBg} 0%, ${authEnd} 100%)`);
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
    // Priority: explicit components.header block (verifier schema) → derive from branding (standard schema)
    if (config.components?.header) {
      root.style.setProperty('--theme-header-bg', config.components.header.backgroundColor);
      root.style.setProperty('--theme-header-text', config.components.header.textColor);
      root.style.setProperty('--theme-header-height', config.components.header.height);
      root.style.setProperty('--theme-header-logo-height', config.components.header.logoHeight);
      // Use explicit gradient if provided, otherwise derive a subtle one
      const gradient = config.components.header.backgroundGradient
        ?? this.buildHeaderGradient(config.components.header.backgroundColor, config.branding.primaryColor);
      root.style.setProperty('--theme-header-bg-gradient', gradient);
    } else {
      root.style.setProperty('--theme-header-bg', '#ffffff');
      root.style.setProperty('--theme-header-text', config.branding.primaryColor);
      root.style.setProperty('--theme-header-height', '64px');
      root.style.setProperty('--theme-header-logo-height', '40px');
      root.style.setProperty('--theme-header-bg-gradient', this.buildHeaderGradient('#ffffff', config.branding.primaryColor));
    }

    // ── Page Title & Favicon ──
    document.title = config.branding.name;
    if (config.branding.faviconUrl) {
      this.updateFavicon(config.branding.faviconUrl);
    }

    // ── Theme Color (browser chrome) ──
    this.updateThemeColor(primaryDark);
  }

  /**
   * Apply hardcoded Altia theme as last-resort fallback
   */
  private applyHardcodedAltiaTheme(): void {
    const fallbackTheme: ThemeConfig = {
      tenantId: 'altia',
      branding: {
        name: 'Verifier Proximity',
        primaryColor: '#001E8C',
        primaryDark: '#001570',
        secondaryColor: '#00ff94',
        logoUrl: 'assets/logos/altia-logo-dark.svg'
      },
      gradients: {
        primary: { start: '#1E49E2', end: '#00338D', angle: 135 },
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
   * Build a subtle header gradient: base color → primary tint at ~6% opacity.
   * Works with any 6-digit hex primary color.
   *
   * @param base   Header background (e.g. '#ffffff')
   * @param primary Brand primary hex color (e.g. '#00338D')
   */
  private buildHeaderGradient(base: string, primary: string): string {
    // Append 05 (≈ 2% opacity) to the primary hex to create an almost-invisible tint
    const tint = primary.startsWith('#') && primary.length === 7
      ? `${primary}05`
      : primary;
    return `linear-gradient(180deg, ${tint} 0%, ${base} 50%, ${base} 100%)`;
  }

  /**
   * Update favicon dynamically (both standard and Apple touch icon)
   *
   * @param faviconUrl Favicon URL
   */
  private updateFavicon(faviconUrl: string): void {
    const head = document.getElementsByTagName('head')[0];

    // Standard favicon
    let link: HTMLLinkElement | null = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      head.appendChild(link);
    }
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = faviconUrl;

    // Apple touch icon
    let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement('link');
      head.appendChild(appleLink);
    }
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = faviconUrl;
  }

  /**
   * Update the <meta name="theme-color"> tag dynamically
   * Affects browser chrome color on mobile and PWA title bar
   *
   * @param color CSS color value
   */
  private updateThemeColor(color: string): void {
    let meta: HTMLMetaElement | null = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }
}
