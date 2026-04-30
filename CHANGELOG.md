# Changelog

All notable changes to the Enterprise Proximity Verifier PWA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.4] - 2026-04-30

### Fixed

- **Welcome screen mojibakes accented user names** (`sse-listener.service.ts`).
  `parseJwtClaims()` decoded the JWT payload via `atob()` and passed the resulting
  binary string straight to `JSON.parse()`. Multi-byte UTF-8 sequences (e.g. `José`
  = `0x4A 0x6F 0x73 0xC3 0xA9`) were interpreted as Latin-1, so the welcome screen
  rendered names like `JosÃ©` instead of `José`. Fixed by converting the binary
  string to a `Uint8Array` and decoding it explicitly with `TextDecoder('utf-8')`
  before parsing JSON.

## [1.2.3] - 2026-04-29

### Fixed

- **Post-verification redirect goes to issuer root instead of returning to proximity** (`verification-page.component.ts/html`).
  The `[redirectUrl]` input of `<app-welcome-message>` was never bound, so the component always
  fell back to its default `'/'`, which resolved to the issuer host root. The `homeUri` parameter
  sent by the backend in the OAuth2 redirect was also being read but silently discarded.
  Added a `redirectUrl` signal, stored `homeUri` on OAuth2 redirect receipt, and bound it
  as `[redirectUrl]="redirectUrl()"` in the template.

## [1.2.2] - 2026-04-27

### Fixed

- **QR code no escaneable — URL relativa en el payload** (`qr-generation.service.ts`).
  `toWalletUrl()` producía `/wallet/protocol/callback?authorization_request=…` cuando
  `walletUrl` era un path relativo (p. ej. `/wallet`, hardcodeado en `env.template.js`
  desde el commit `7056010`). Las cámaras de móvil no pueden resolver URLs relativas,
  por lo que el QR generado no era funcional. Se añade conversión relativa → absoluta
  usando `window.location.origin` cuando `walletBase.startsWith('/')`.

- **`env.js` de desarrollo con `localhost:8082` sin context-path** (`src/assets/env.js`).
  `verifierBackendUrl` apuntaba a `http://localhost:8082`, que no incluía el prefix
  `/verifier` requerido desde EUDI-064 y que además no tiene sentido en un entorno donde
  no existe modo de desarrollo directo (sin Docker/nginx). Se deja a `""` para activar
  el fallback same-origin (`window.location.origin + '/verifier'`) consistente con
  el comportamiento en Docker.

## [1.2.1] - 2026-04-27

### Fixed

- **Copy QR copia la URL de callback en lugar del deep link** (`qr-display.component.ts`).
  `extractAuthRequest()` usaba `new URL(payload)` sin base, que lanza excepción cuando el
  payload es una URL relativa (`/wallet/protocol/callback?authorization_request=…`). El bloque
  catch devolvía el payload sin modificar, por lo que el portapapeles recibía la URL de callback
  en lugar del `openid4vp://…` que el wallet necesita para el paste flow. Corregido pasando
  `window.location.origin` como base: `new URL(payload, window.location.origin)`.

- **Logo dark de Dome cae al default de Altia** (`eudistack-platform-assets/tenants/dome/theme.json`).
  `logoDarkUrl` estaba a `null`, por lo que el operador `??` del signal `logoDarkUrl` en
  `theme.service.ts` activaba el fallback a `assets/logos/altia-logo-dark.svg`. El archivo
  `logo-dark.svg` ya existía en el bucket del tenant; se referencia ahora como
  `/assets/tenant/logo-dark.svg` (reescrito en runtime a `/assets/tenants/dome/logo-dark.svg`).

### Fixed (EUDI-094 multi-tenant rollout)

- **Per-tenant OIDC client + redirect path** (commit `54c3cd6`).
  `redirect_uri` was built as `${origin}/login` but the SPA is served
  under `/proximity/`, so the verifier rejected it. `client_id` was
  hard-coded to `proximity-verifier-pwa`; the verifier now registers
  one client per tenant (`proximity-verifier-pwa-{hostname-first-label}`)
  and requires the env suffix. Both `verification-page.component.ts` and
  `sse-listener.service.ts` now build `${origin}/proximity/login` and
  derive the client id from `window.env.tenant`.
- **Same-origin verifier URL must include `/verifier` prefix** (commit
  `d376ddc`). In Atlassian-style routing CloudFront proxies
  `/verifier/*` to the ALB. The PWA's `getBackendUrl()` resolver and the
  `verifierBackendUrl` getter in `environment.ts` /
  `environment.production.ts` returned `window.location.origin` (no
  prefix), so `/oidc/authorize` hit the S3 bucket and got a 403 from
  CloudFront. Appended `/verifier` to the same-origin fallback.
- **GitHub Actions env — removed stale `VERIFIER_BACKEND_URL`.** The var
  pointed to `https://verifier-stg.api.altia.eudistack.net` (legacy DNS).
  Removed from the `stg` environment so `envsubst` resolves it to empty
  and the getter activates same-origin mode.

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

[Unreleased]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa/releases/tag/v1.0.0
