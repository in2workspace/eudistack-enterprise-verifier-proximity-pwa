/**
 * Theme Configuration Model
 * 
 * Defines the structure for tenant-specific branding and styling.
 * Loaded from /assets/tenants/{tenantId}/theme.json (served by CloudFront/nginx from platform-assets).
 */

export interface ThemeConfig {
  tenantId?: string;       // verifier schema; optional — standard schema uses tenantDomain
  tenantDomain?: string;   // standard platform schema
  branding: BrandingConfig;
  gradients?: GradientsConfig;
  components?: ComponentsConfig;
  content?: ContentConfig;
  i18n?: I18nConfig;
}

export interface BrandingConfig {
  name: string;
  primaryColor: string;
  primaryDark?: string;
  primaryLight?: string;
  secondaryColor: string;
  backgroundColor?: string;
  textColor?: string;
  logoUrl: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  /** Standard platform schema — auth gradient colors */
  auth?: { background?: string; gradientEnd?: string };
}

export interface GradientsConfig {
  primary: GradientDefinition;
  success?: GradientDefinition;
  error?: GradientDefinition;
}

export interface GradientDefinition {
  start: string;
  end: string;
  angle: number;
}

export interface ComponentsConfig {
  header?: HeaderConfig;
  card?: CardConfig;
}

export interface HeaderConfig {
  backgroundColor: string;
  backgroundGradient?: string;
  textColor: string;
  height: string;
  logoHeight: string;
}

export interface CardConfig {
  backgroundColor: string;
  borderRadius: string;
  shadow: string;
}

export interface ContentConfig {
  links: Array<{ title: string; url: string }>;
  footer: string;
}

export interface I18nConfig {
  defaultLang: string;
  available: string[];
}
