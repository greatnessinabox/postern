# Postern development Makefile
# Common commands for local development.

.PHONY: help install dev build lint format check typecheck test fonts db-generate clean

help:
	@echo "Postern development commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install      Install all dependencies"
	@echo "  make fonts        Download bundled brand fonts"
	@echo ""
	@echo "Development:"
	@echo "  make dev          Start development servers"
	@echo "  make build        Build all packages"
	@echo "  make lint         Run Biome"
	@echo "  make format       Format with Biome"
	@echo "  make typecheck    Run tsc --noEmit across packages"
	@echo "  make check        lint + typecheck + test"
	@echo ""
	@echo "Testing:"
	@echo "  make test         Run Vitest"
	@echo ""
	@echo "Storage:"
	@echo "  make db-generate  Generate Drizzle migrations"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        Remove build artifacts and caches"

install:
	pnpm install

fonts:
	./scripts/fetch-fonts.sh

dev:
	pnpm dev

build:
	pnpm build

lint:
	pnpm lint

format:
	pnpm format

typecheck:
	pnpm typecheck

check: lint typecheck test

test:
	pnpm test

db-generate:
	pnpm --filter @postern/storage db:generate

clean:
	rm -rf node_modules/.cache
	rm -rf apps/*/.next
	rm -rf packages/*/dist
	rm -rf .turbo
	find . -name "*.tsbuildinfo" -delete
