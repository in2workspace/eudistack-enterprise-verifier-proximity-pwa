# ---------------------------------------------------------------------------
# Makefile - KPMG Verifier PWA (Ionic + Angular)
#
# 100% PWA standalone - NO backend required
# ---------------------------------------------------------------------------

.PHONY: help install up build build-prod test test-watch test-coverage \
        lint lint-fix clean serve pwa-test

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---------- Quick Start -----------------------------------------------------

install: ## Install npm dependencies
	npm install

up: install ## Start development server (alias: serve)
	@echo "--------------------------------------------"
	@echo " Verifier PWA:  http://localhost:4200"
	@echo " Architecture:  100% PWA (no backend)"
	@echo "--------------------------------------------"
	npx ng serve --open

serve: up ## Alias for 'up'

# ---------- Build -----------------------------------------------------------

build: install ## Development build
	npx ng build

build-prod: install ## Production build (optimized)
	npx ng build --configuration production

# ---------- Testing ---------------------------------------------------------

test: ## Run unit tests (Jest)
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

# ---------- Quality ---------------------------------------------------------

lint: ## Run ESLint
	npx ng lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

# ---------- PWA Development -------------------------------------------------

pwa-test: build-prod ## Build PWA + serve with http-server to test Service Worker
	@echo "Building production PWA..."
	@npx ng build --configuration production
	@echo "--------------------------------------------"
	@echo " Serving PWA on http://localhost:8080"
	@echo " Service Worker enabled"
	@echo " Test offline: DevTools → Application → Service Workers → Offline"
	@echo "--------------------------------------------"
	@npx http-server dist/eudistack-verifier-pwa-kpmg/browser -p 8080 -c-1

# ---------- Cleanup ---------------------------------------------------------

clean: ## Remove build artifacts and node_modules
	rm -rf dist node_modules .angular coverage

# ---------- Info ------------------------------------------------------------

info: ## Show project info
	@echo "======================================"
	@echo " KPMG Verifier PWA"
	@echo "======================================"
	@echo " Stack:         Ionic 8 + Angular 19"
	@echo " Architecture:  100% PWA (no backend)"
	@echo " Protocols:     OID4VP 1.0, DCQL, HAIP"
	@echo " Storage:       IndexedDB (ngx-indexed-db)"
	@echo " Crypto:        Web Crypto API + jose"
	@echo " Testing:       Jest"
	@echo "======================================"
	@node --version
	@npm --version
	@echo "======================================"
