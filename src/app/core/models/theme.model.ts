/**
 * Theme Configuration Model
 * 
 * Defines the structure for tenant-specific branding and styling.
 * Loaded from assets/themes/{tenantId}.theme.json or assets/theme.json
 */

export interface ThemeConfig {
  tenantId: string;
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
