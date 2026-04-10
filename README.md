# Enterprise Proximity Verifier PWA

> **OAuth2 Client for eudistack-core-verifier** — Acts as OAuth2 client to initiate verification sessions and display QR codes for wallet scanning.

## Overview

Enterprise Proximity Verifier PWA is a **Progressive Web Application** that acts as an **OAuth2 public client** of the verifier backend, following the same pattern as the issuer's MFE login.

**OAuth2 Flow:** PWA → `/oauth2/authorize` → Backend redirects with `authRequest` → Display QR → SSE events

## Architecture

- **Backend**: `eudistack-core-verifier` (Java Spring Boot)
  - OAuth2 Authorization Server
  - Generates authorization request JWTs
  - Validates VP tokens from wallets
  - Emits SSE events with verification results
- **Frontend**: This PWA (Angular 19 + Ionic 8)
  - **OAuth2 public client** (registered in backend)
  - Redirects to `/oauth2/authorize` to initiate flow
  - Receives `authRequest` via OAuth2 redirect
  - Displays QR codes
  - Listens to SSE for verification status
- **Deployment**: 
  - Backend: `http://localhost:8082` (development)
  - Frontend: `http://localhost:4200` (development)
- **Framework**: Ionic 8.2.x + Angular 19.2.x (standalone components)
- **Protocols**: OAuth2 + OID4VP 1.0 + SSE
- **i18n**: @ngx-translate/core 16.x (en, es, ca)

## OAuth2 Client Flow

```
┌─────────────┐         ┌──────────────────┐         ┌────────────┐
│ Verifier PWA│────1───▶│  Core Verifier   │◀───3───│   Wallet   │
│ (OAuth2     │◀───2────│    (Backend)     │         │   (EUDIW)  │
│  Client)    │         └──────────────────┘         └────────────┘
                                 │
                                 └──────────4──────────┘
                                    (SSE 'redirect')

1. PWA → Backend: GET /oauth2/authorize?client_id=proximity-verifier-pwa&...
2. Backend → PWA: Redirect to /login?authRequest=openid4vp://...&state=...
3. PWA displays QR → Wallet scans → POST /oid4vp/auth-response (to backend)
4. Backend → PWA: SSE event 'redirect'
```

**Client Registration Required:** PWA must be registered as OAuth2 client in backend.  
**See [docs/OAUTH2-CLIENT.md](docs/OAUTH2-CLIENT.md) for registration details.**

## Project Structure

```
src/
  app/
    core/
      services/
        verifier-api.service.ts      # HTTP client for backend API
        sse-listener.service.ts      # Server-Sent Events listener
        qr-generation.service.ts     # QR code management (from backend)
        verification-flow.service.ts # Flow orchestration
      models/
        error.model.ts               # Error types
        verification.model.ts        # Verification state models
    features/
      verification/
        pages/
          verification-page/         # Main verification UI
        components/
          qr-display/                # QR code display component
          validation-popup/          # Validation status popup
          welcome-message/           # Success message component
    shared/
      components/
        ... (shared UI components)
  assets/
    i18n/                            # Translations (en, es, ca)
    env.js                           # Runtime configuration (backend URL)
```

**FASE 1 Services (API Integration):**
- `VerifierApiService` → HTTP calls to backend (`GET /oid4vp/auth-request/{id}`)
- `SseListenerService` → SSE connection (`GET /api/login/events?state={state}`)
- `QrGenerationService` → Receives authRequest from backend redirect
- `VerificationFlowService` → Orchestrates QR + SSE

**Backend Configuration:**
- `assets/env.js` → `verifierBackendUrl: "http://localhost:8082"` (development)
- Production: Override via environment-specific config

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

## JAR by Value (No Backend Required)

This PWA uses **JAR by Value** instead of JAR by Reference, meaning the signed authorization request JWT is included **directly in the QR code** rather than fetched from an HTTP endpoint.

**Why?** This PWA has **NO backend server** — it's a static web app deployed to CDN. JAR by Value allows the wallet to read the authorization request without making any HTTP GET call.

### QR Code Format

```
openid4vp://?client_id=did:key:z...&request={SIGNED_JWT}
```

- `client_id`: Verifier's DID:key (ephemeral, generated at PWA startup)
- `request`: Entire signed JWT containing authorization request

### Differences vs Core Verifier

| Aspect | Core Verifier (Backend) | Proximity PWA (No Backend) |
|--------|------------------------|----------------------------|
| Authorization Request | JAR by Reference (`request_uri`) | **JAR by Value (`request`)** |
| QR Size | Small (~200 chars) | Larger (~1500-2000 chars) |
| HTTP GET endpoint | Required (`/oid4vp/auth-request/{id}`) | ❌ Not needed |
| Wallet flow | Scan QR → GET JWT → Parse | Scan QR → Parse JWT directly |

### Response Flow

The wallet sends the VP token back to `response_uri` (configured in the JWT). Since there's no backend, the PWA must handle the response via:

1. **Same-device flow** (recommended for proximity): Wallet navigates back to PWA URL with POST data
2. **Service Worker interception**: Capture POST in service worker, store in Cache API
3. **Alternative**: WebSocket relay (requires minimal infrastructure)

See [docs/JAR-BY-VALUE.md](docs/JAR-BY-VALUE.md) for detailed implementation guide.

## Documentation

- [ROADMAP](docs/EUDI-024-verifier-pwa-kpmg/ROADMAP.md) - 10-sprint development plan
- [TASKS](docs/EUDI-024-verifier-pwa-kpmg/TASKS.md) - Detailed task breakdown
- [STACK](docs/EUDI-024-verifier-pwa-kpmg/STACK.md) - Technology stack alignment
- [IMPLEMENTATION_GUIDE](docs/EUDI-024-verifier-pwa-kpmg/IMPLEMENTATION_GUIDE.md) - Developer guide
- [JAR-BY-VALUE](docs/JAR-BY-VALUE.md) - ⭐ No backend implementation guide

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
