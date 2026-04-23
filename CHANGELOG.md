# Changelog

All notable changes to the Enterprise Proximity Verifier PWA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-04-23

### Changed (EUDI-094 — runtime per-tenant theme from shared bucket)

- **`theme.service.ts`** — `loadTheme()` ahora pide `/assets/tenants/<tenant>/theme.json` (URL absoluta, bucket compartido servido por CloudFront). Nuevo `stripEnvSuffix()` para convertir `sandbox-stg` → `sandbox` desde el hostname. Los paths legacy `assets/tenant/*` dentro del theme se reescriben a `/assets/tenants/<tenant>/*`. Fallback a `altia` si el tenant resuelto no tiene theme publicado.
- **`index.html`** — favicon default pasa a ser el producto (`assets/icons/pwa-192x192.png`). El ThemeService inyecta dinámicamente el favicon del tenant tras resolverlo.
- **`ngsw-config.json`** — `/assets/tenants/**` excluido del asset prefetch; el theme del tenant se cachea en dataGroup `tenant-theme` con freshness (1h).
- **`.github/workflows/deploy.yml`** — eliminada la inyección build-time de tenant assets y el input `tenant`. El build ahora es único y se publica a `s3://.../proximity/`; se invalidan todas las CloudFront STG del entorno.
- **`.github/workflows/release.yml`** — el release dispara `deploy.yml` automáticamente tras el tag sin parametrizar tenant.

## [1.1.0] - 2026-04-20

### Added
- Initial project setup with Ionic 8.2.x + Angular 19.2.x
- Core project structure: `core/`, `features/`, `shared/` directories
- Build tooling: Angular CLI 19.2.x, Jest 29.x for testing
- Code quality: ESLint with angular-eslint rules, strict TypeScript
- CI/CD: GitHub Actions pipeline (lint, test, build, security audit)
- Documentation: README.md, CONTRIBUTING.md, Makefile
- Dependencies: jose 6.1.x, @noble/curves 2.0.x, ngx-indexed-db 19.x
- Path aliases: @core, @app, @services, @helpers, @shared

### Changed
- Aligned with SaaS multi-tenant platform release v3.1.0; no breaking changes.

### Fixed
- PWA install banner not appearing in STG due to Service Worker activation race condition.
- Banner flickering caused by fallback timer overwriting a real install prompt.
- iOS/iPadOS detection incorrectly blocking macOS Chrome and Edge browsers.

### Removed
Removed unused dependencies to reduce install size and maintenance surface:
	- `ng-mocks`
	- `ts-node`
	- `@angular/forms`
	- `dayjs`
	- `fflate`
	- `uuid`

## [1.0.0] - 2026-04-02

### Added
- Project initialization (Fase 0 complete)
- PWA standalone architecture (100% client-side verification)
- TypeScript strict mode configuration
- Jest testing setup with coverage reporting
- Development and production build configurations
- Makefile with common development tasks

[Unreleased]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/releases/tag/v1.0.0
