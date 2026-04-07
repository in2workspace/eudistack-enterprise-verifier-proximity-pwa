# Enterprise Proximity Verifier PWA

> **100% PWA standalone** — Credential verifier compliant with OID4VP 1.0, DCQL, and HAIP 1.0 for enterprise proximity verification.

## Overview

Enterprise Proximity Verifier PWA is a **100% browser-based Progressive Web Application** that validates employee credentials presented by EUDI Wallets. All cryptographic validation, trust framework checks, and revocation verification happen **locally in the browser** using Web Crypto API.

**Key principle**: Zero backend infrastructure — all validation logic runs client-side.

## Architecture

- **Deployment**: Static files only (CDN/S3) — **NO backend server**
- **Framework**: Ionic 8.2.x + Angular 19.2.x (standalone components)
- **Protocols**: OID4VP 1.0, DCQL, HAIP 1.0
- **Crypto**: Web Crypto API + jose 6.1.x + @noble/curves 2.0.x (100% browser)
- **Storage**: ngx-indexed-db 19.x (trust framework + audit log local)
- **Testing**: Jest 29.7.x + jest-preset-angular 14.2.x
- **i18n**: @ngx-translate/core 16.x (en, es, ca)

## Verification Flow (100% Browser)

```
1. User lands → PWA generates ephemeral keypair (Web Crypto API)
                → Creates OID4VP authorization request (JAR signed locally)
                → Displays QR code

2. Wallet scans QR → Presents VP token (2 VCs: Employee + DID)
                   → POST to /direct_post (intercepted by Service Worker)

3. PWA validates (ALL IN BROWSER):
   ✓ VP signature verification (Web Crypto API)
   ✓ VC signatures verification (Web Crypto API)
   ✓ Issuer trust framework check (local IndexedDB)
   ✓ Credential status via HTTP GET (Bitstring Status List)
   ✓ Identity match (first_name + family_name cross-check)
   ✓ Nonce validation
   ✓ Timestamp validation

4. Result → Visual feedback (animated checks)
          → Audit log stored locally (IndexedDB)
          → NO data sent to any server
```

## Project Structure

```
src/
  app/
    core/
      services/
        verifier.service.ts         # OID4VP protocol logic
        crypto.service.ts            # Signature verification
        trust.service.ts             # Trust framework validation
        status-list.service.ts       # Revocation checks
        audit.service.ts             # Audit logging
      models/
        vp-token.model.ts            # VP/VC data structures
        dcql.model.ts                # DCQL query models
      guards/
        ... (placeholder)
      interceptors/
        ... (placeholder)
    features/
      verification/
        pages/
          verification-page/         # Main QR + validation UI
    shared/
      components/
        qr-display/                  # QR code component
        validation-checks/           # Validation progress UI
  assets/
    i18n/                            # Translations (en, es, ca)
    trust-framework/
      trusted-issuers.json           # Trust anchor list
```

## Local Development

### Prerequisites

- Node.js 22.x
- npm 10.x

### Quick Start (Makefile)

```bash
make up              # Install deps + start dev server (http://localhost:4200)
make build           # Development build
make build-prod      # Production build
make test            # Run Jest tests
make test-coverage   # Coverage report
make lint            # ESLint
make pwa-test        # Test PWA + Service Worker
make clean           # Remove build artifacts
make help            # Show all available commands
```

### Alternative: NPM Commands

```bash
npm install
npm start                # Development server (http://localhost:4200)
npm test                 # Run Jest tests
npm run test:coverage    # Coverage report
npm run lint             # ESLint
npm run build            # Production build
```

### Environment Configuration

See `src/environments/environment.ts` for local configuration.

**Key settings:**
- `verifierDid`: Verifier identifier (default: did:web:verifier.kpmg.eudistack.com)
- `sessionTimeout`: QR code timeout in seconds (default: 300)
- `auditRetentionDays`: Audit log retention (default: 90)
- `trustedIssuersUrl`: Trust framework JSON (default: assets/trust-framework/trusted-issuers.json)

### Testing

- Unit tests: `npm test` (Jest)
- Coverage threshold: 80%
- Test files: `*.spec.ts` (co-located with source)

## Deployment (Static Hosting)

**Architecture**: PWA = Static files only (HTML/JS/CSS) → Deploy to CDN

### Option 1: AWS S3 + CloudFront

```bash
# Build production
make build-prod

# Deploy to S3 bucket
aws s3 sync dist/eudistack-verifier-pwa-kpmg/browser/ s3://kpmg-verifier-pwa/

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id EXXX --paths "/*"
```

### Option 2: Netlify

```bash
# Build production
make build-prod

# Deploy
npx netlify deploy --prod --dir=dist/eudistack-verifier-pwa-kpmg/browser
```

### Option 3: Vercel

```bash
# Build production
make build-prod

# Deploy
npx vercel --prod
```

### Option 4: GitHub Pages

```bash
# Build production with base href
ng build --configuration production --base-href=/eudistack-verifier-pwa-kpmg/

# Deploy to gh-pages branch
npx angular-cli-ghpages --dir=dist/eudistack-verifier-pwa-kpmg/browser
```

**Requirements**: 
- HTTPS mandatory (Service Worker requirement)
- SPA redirect: all routes → index.html
- CORS headers for Status List fetching

## Security

- **100% Client-Side**: All validation happens in browser (Web Crypto API)
- **Zero Backend**: No server-side processing, no API calls (except Status List fetch)
- **Ephemeral Keys**: Generated per-session, never persisted
- **No PII Storage**: Audit logs contain only hashes (no credential data)
- **Trust Framework**: Embedded in PWA (assets/trust-framework/trusted-issuers.json)
- **HTTPS Only**: Enforced via CSP
- **Audit Trail**: 90-day retention in local IndexedDB (configurable)

## Compliance

- ✅ OID4VP 1.0 (Authorization Request + VP Token validation)
- ✅ DCQL (Declarative Credential Query Language)
- ✅ HAIP 1.0 Basic Profile (no DPoP/PAR for PWA)
- ✅ eIDAS 2.0 (ARF 1.5.0 credential types)
- ⚠️ **Not eIDAS-qualified**: For demonstration/pilot use only

## Documentation

- [ROADMAP](docs/EUDI-024-verifier-pwa-kpmg/ROADMAP.md) - 10-sprint development plan
- [TASKS](docs/EUDI-024-verifier-pwa-kpmg/TASKS.md) - Detailed task breakdown
- [STACK](docs/EUDI-024-verifier-pwa-kpmg/STACK.md) - Technology stack alignment
- [IMPLEMENTATION_GUIDE](docs/EUDI-024-verifier-pwa-kpmg/IMPLEMENTATION_GUIDE.md) - Developer guide

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

This project is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for details.

## Maintainers

- EUDIStack Team <dev@eudistack.com>
- KPMG Digital Identity Practice

## Version

**0.1.0** (Sprint 1 - Project Setup)

---
