# AGENTS.md

## Purpose & Scope
This file defines repository-specific operating rules for coding agents in `abrechnung`.
It applies to the full monorepo (`backend`, `frontend`, `common`) unless a task explicitly says otherwise.
When generic agent behavior conflicts with this file, follow this file.

## Repo Map
- `backend`: Node.js + TypeScript, Express 5, tsoa-generated routes/spec, MongoDB, Redis, worker process.
- `frontend`: Vue 3 + TypeScript + Vite.
- `common`: Shared TypeScript package (types, utilities, PDF/data helpers) consumed by backend and frontend.

## Core Engineering Principles
- Prefer readability over cleverness.
- Keep code explicit, predictable, and easy to maintain.
- Make focused changes; avoid unrelated refactors.
- Preserve existing architecture and conventions unless the task requires architectural changes.
- Performance matters: prefer solutions that keep runtime fast for end users.

## Execution Rules (Docker-first)
- Default execution path is Docker Compose from repo root.
- Prefer existing service names from `docker-compose.yml`.
- Local package commands (`npm run ...`) are allowed for fast package-local iteration when equivalent, but final validation should align with repo CI intent.

## Quality Gate (Repo-Standard)
Run checks only for impacted areas by default. Expand scope when changes are cross-cutting.

### Code Quality
- Biome version must always match the version pinned in `backend/package.json` (`devDependencies.@biomejs/biome`).
- Run Biome checks aligned with CI:
```bash
biome ci --changed --error-on-warnings --no-errors-on-unmatched .
```

### Common Package
```bash
docker compose run common npm run test
```

### Backend Package
```bash
docker compose run backend npm run setup
docker compose run backend npm run test
```

### Frontend Package
Use the same validation intent as CI production build:
```bash
docker compose build frontend
docker run abrechnung-frontend "npm run build"
```

## Coding Style & TypeScript
- Follow repository formatter/linter settings (Biome + existing frontend ESLint usage where applicable).
- Respect TypeScript strict mode in all packages; do not weaken compiler settings.
- Do not add explicit function return type annotations (`func(): Type`) unless the task explicitly requires them.
- Prefer normal static `import` statements. Do not introduce dynamic `import()` for application code unless the task explicitly requires lazy loading and the reason is documented in the change.
- Favor descriptive naming and small, cohesive functions.
- Avoid hidden side effects and implicit behavior.
- Keep diffs minimal and task-focused.
- Choose performant implementations over convenience when tradeoffs are significant.

## Frontend Performance Policy
- Keep the main user-facing frontend JavaScript lightweight.
- Heavier JavaScript is acceptable for admin pages/features when needed.
- For frontend changes, prefer lazy loading/code-splitting so admin-only logic does not bloat the main user path.

## Git & PR Rules
- Branch from `main`.
- Use Conventional Commits:
  - `feat:` new behavior
  - `fix:` bug fix
  - `refactor:` internal restructuring without behavior change
  - `test:` test-only changes
  - `docs:` documentation-only changes
  - `chore:` maintenance/config updates
- Do not amend/rewrite history after review starts unless explicitly requested.
- PR descriptions should include: what changed, why, risk level, and executed tests/checks.

## Safety Rules
- Never run destructive commands (e.g. force reset, broad deletes) unless explicitly requested.
- Do not change CI workflows/tooling versions unless required by the task.
- Do not commit secrets or modify tracked environment defaults without explicit task scope.

## Definition of Done
A task is done when all of the following are true:
- Requested behavior is implemented correctly.
- Relevant checks/tests for changed scope were run and results are reported.
- Documentation/comments are updated when behavior or developer workflows changed.
- No unrelated files or behavior were modified.
