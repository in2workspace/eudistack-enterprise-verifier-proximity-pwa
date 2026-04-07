# Contributing to Enterprise Proximity Verifier PWA

Thank you for your interest in contributing! This document outlines our development practices aligned with EUDIStack standards.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Requirements](#testing-requirements)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)

---

## Code of Conduct

- **Respectful communication**: All interactions must be professional and inclusive.
- **Constructive feedback**: Focus on the code, not the person.
- **Security first**: Never commit secrets, API keys, or PII.

---

## Getting Started

### Prerequisites

- Node.js 22.x or higher
- npm 10.x or higher
- Git 2.x or higher
- VS Code (recommended, with ESLint + Prettier extensions)

### Initial Setup

```bash
git clone https://github.com/in2workspace/eudistack-enterprise-verifier-proximity-pwa.git
cd eudistack-enterprise-verifier-proximity-pwa
npm install
npm start  # http://localhost:8100
```

### Repository Structure

Follow the **Hexagonal Architecture** pattern:

```
src/app/
  core/          # Domain logic (services, models)
  features/      # Feature modules (pages, components)
  shared/        # Shared utilities (pipes, directives)
```

**Never** create circular dependencies between `core` and `features`.

---

## Development Workflow

### Branch Strategy

- `main` → Production-ready code
- `develop` → Integration branch
- `feature/EUDI-024-*` → Feature branches
- `hotfix/*` → Emergency fixes

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/EUDI-024-<short-description>
```

### Syncing with Upstream

```bash
git fetch origin
git rebase origin/develop
```

---

## Coding Standards

### TypeScript

- **Strict mode enabled**: No `any` types (use `unknown` if necessary)
- **Explicit return types**: Always declare function return types
- **Readonly by default**: Use `readonly` for arrays/objects unless mutation required

### Angular

- **Standalone components**: No NgModules (except root app.module.ts if needed)
- **Signal-based state**: Prefer Angular signals over RxJS for local state
- **OnPush change detection**: All components must use `ChangeDetectionStrategy.OnPush`
- **Lazy loading**: Feature modules loaded via route-level code splitting

### Ionic

- **Component naming**: Use `ion-` prefix for all Ionic components
- **Theming**: Use CSS variables from `theme/variables.scss` (never hardcoded colors)
- **Responsive design**: Test on mobile (360px) + tablet (768px) + desktop (1280px)

### File Naming

- Components: `verification-page.component.ts`
- Services: `verifier.service.ts`
- Models: `vp-token.model.ts`
- Guards: `auth.guard.ts`

### Folder Structure (per feature)

```
features/verification/
  pages/
    verification-page/
      verification-page.component.ts
      verification-page.component.html
      verification-page.component.scss
      verification-page.component.spec.ts
  components/ (if needed)
  services/ (if feature-specific)
```

---

## Testing Requirements

### Coverage

- **Minimum threshold**: 80% (statements, branches, functions, lines)
- **Critical paths**: 100% coverage (crypto, signature validation, trust framework)

### Test Types

1. **Unit tests**: All services, components, pipes, guards
2. **Integration tests**: Multi-service workflows (e.g., VP validation pipeline)
3. **E2E tests**: (Planned for Sprint 8) Full verification flow

### Writing Tests

```typescript
describe('VerifierService', () => {
  let service: VerifierService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VerifierService, /* mock dependencies */]
    });
    service = TestBed.inject(VerifierService);
  });

  it('should validate VP signature', async () => {
    const vpToken = mockVPToken();
    const result = await service.validateVPSignature(vpToken);
    expect(result.valid).toBe(true);
  });
});
```

### Running Tests

```bash
npm test                   # Watch mode
npm run test:coverage      # Coverage report (open coverage/lcov-report/index.html)
npm run test:ci            # CI mode (no watch, fails on <80% coverage)
```

---

## Commit Guidelines

### Conventional Commits

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Add/update tests
- `chore`: Build process, tooling

**Scopes:**
- `verification`: Verification page/flow
- `crypto`: Cryptographic services
- `trust`: Trust framework
- `status-list`: Revocation checks
- `audit`: Audit logging
- `i18n`: Internationalization

**Examples:**

```bash
feat(verification): add QR code timeout countdown
fix(crypto): correct JWS signature validation for ES256
docs(readme): update deployment instructions
test(status-list): add revocation check unit tests
```

### Commit Message Body

- Explain **why** the change is needed (not just what changed)
- Reference related issues: `Closes #123` or `Related to #456`

---

## Pull Request Process

### Before Submitting

1. **Tests pass**: `npm test` (100% pass rate)
2. **Linting passes**: `npm run lint` (zero errors/warnings)
3. **Coverage maintained**: `npm run test:coverage` (≥80%)
4. **Build succeeds**: `npm run build` (no errors)
5. **Self-review**: Read your own diff before submitting

### PR Template

```markdown
## Description

Brief description of the change.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues

Closes #XXX

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings introduced
- [ ] Tests pass locally
- [ ] Coverage ≥80%
```

### Review Process

- **Required reviewers**: 1 (for minor changes), 2 (for major features)
- **Approval criteria**: All checks pass + reviewer approval
- **Merge strategy**: Squash and merge (clean history)

### CI/CD Checks

GitHub Actions will automatically run:

1. **Linting**: ESLint
2. **Unit tests**: Jest (with coverage)
3. **Build**: Production build
4. **Security scan**: npm audit

All checks must pass before merge.

---

## Architecture Guidelines

### Hexagonal Architecture (Ports & Adapters)

```
Domain Layer (core/services)
  ↓ (uses)
Ports (core/models + interfaces)
  ↓ (implemented by)
Adapters (infrastructure - HTTP, IndexedDB, Web Crypto)
```

**Rules:**
- Domain services **never** depend on adapters
- Adapters implement port interfaces
- Feature components call domain services (not adapters directly)

### Dependency Injection

Use Angular DI with `providedIn: 'root'` for singleton services:

```typescript
@Injectable({ providedIn: 'root' })
export class VerifierService { }
```

### State Management

- **Local state**: Angular signals
- **Global state**: (Not implemented yet — reserved for Sprint 7)
- **Persistent state**: ngx-indexed-db

---

## Protocol Compliance

When implementing protocol features (OID4VP, DCQL, HAIP), follow these steps:

1. **Read the spec**: Normative reference in `docs/_shared/standards/`
2. **Check gap analysis**: `docs/_shared/protocols/` (if available)
3. **Write tests first**: Spec compliance tests (given/when/then)
4. **Implement**: Follow spec exactly (no "creative interpretations")
5. **Document deviations**: If spec is ambiguous, document decision in code comment

---

## Security Practices

- **No secrets in code**: Use environment variables
- **HTTPS only**: Enforce via CSP header
- **Input validation**: Always validate/sanitize user input
- **Crypto audits**: Never roll your own crypto (use jose, Web Crypto API)
- **Dependency scanning**: Run `npm audit` before committing

---

## Questions?

- **Slack**: #eudistack-dev
- **Email**: dev@eudistack.com
- **GitHub Issues**: Use `question` label

---

**Thank you for contributing to a more secure European digital identity ecosystem!** 🚀
