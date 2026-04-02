# Changelog

All notable changes to the KPMG Verifier PWA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup with Ionic 8.2.x + Angular 19.2.x
- Core project structure: `core/`, `features/`, `shared/` directories
- Build tooling: Angular CLI 19.2.x, Jest 29.x for testing
- Code quality: ESLint with angular-eslint rules, strict TypeScript
- CI/CD: GitHub Actions pipeline (lint, test, build, security audit)
- Documentation: README.md, CONTRIBUTING.md, Makefile
- Dependencies: jose 6.1.x, @noble/curves 2.0.x, ngx-indexed-db 19.x
- Path aliases: @core, @app, @services, @helpers, @shared

## [1.0.0] - 2026-04-02

### Added
- Project initialization (Fase 0 complete)
- PWA standalone architecture (100% client-side verification)
- TypeScript strict mode configuration
- Jest testing setup with coverage reporting
- Development and production build configurations
- Makefile with common development tasks

[Unreleased]: https://github.com/in2workspace/eudistack-verifier-pwa-kpmg/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/in2workspace/eudistack-verifier-pwa-kpmg/releases/tag/v1.0.0
