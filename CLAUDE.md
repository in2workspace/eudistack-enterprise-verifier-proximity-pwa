# Enterprise Verifier (Proximity PWA) — Repo Guide for Claude

> **Per-repo CLAUDE.md.** Loaded only when working inside this repo. The
> SDD Constitution lives in `../eudistack-platform-dev/CLAUDE.md`.

## Identity

Angular 19 + Ionic PWA used as a **proximity Verifier** for in-person
credential presentation flows (QR scanning + BLE / NFC short-range).
Targets enterprise validators (kiosks, mobile devices).

## Tech stack

- **Angular 19** standalone components
- **Ionic 7+** UI primitives
- **TypeScript** strict mode
- **angularx-qrcode** for QR rendering / scanning
- **Jest** + Testing Library for tests
- **ESLint** + Angular ESLint

## Architecture

Standalone components. Signals for local state. Strict conventions:
`../eudistack-platform-dev/.claude/rules/frontend-conventions.md`.

## Common commands

> **Do NOT `ng serve`** — use `make up` from `eudistack-platform-dev`.

| Task | Command |
|------|---------|
| Install | `npm ci` |
| Production build | `npm run build` |
| Tests | `npm test` |
| Lint | `npx eslint .` |

## Protocols (frontend-facing)

- **OID4VP 1.0** with DCQL queries (validator role).
- **SD-JWT VC** parsing for displayed claims.

Normative invariants:
`../eudistack-platform-dev/.claude/rules/protocol-compliance.md`.

## Where to find specs

`../eudistack-platform-dev/docs/EUDISTACK-NNN-*/EUDISTACK-MMM/`. Figma
page **09 Validator**.

## Git workflow

- **Squash merge to `main`.** Conventional Commits + Story footer.

## References

- Constitution: [`../eudistack-platform-dev/CLAUDE.md`](../eudistack-platform-dev/CLAUDE.md)
- Skills: `angular-conventions`, `figma-ux-review`, `commit-conventions`
- Rules: `frontend-conventions`, `protocol-compliance`
