# Testing contracts

Tests are executable specifications of observable behavior. Keep the existing AVA, Vitest and Playwright runners; no Gherkin runner or step-definition layer is needed.

## Choosing the boundary

| Contract                       | Boundary and examples                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Backend application            | HTTP requests, status/body, a subsequent read, downloaded files and outbound work            |
| Frontend interactions          | Real production frontend in Chromium and Firefox; click, type, navigate and use the keyboard |
| Calculation and transformation | Exported functions/classes with explicit inputs and independently specified outputs          |
| Integrations                   | Real MongoDB/Redis, queued jobs, extension interfaces and local HTTP recipients              |
| Infrastructure                 | Process exit status, persisted artifacts and documented database/queue APIs                  |

Given/When/Then can be expressed by scenario names, concise comments and example tables. Use concrete expected values; do not calculate expectations with the function being tested. For a rejection, assert the error and re-read the relevant state. A green status code or a nonempty PDF alone is insufficient evidence of correctness.

Do not read application source, extract template handlers, inspect Vue internals or assert internal method sequences. Adapters for external HTTP providers, browser APIs and scoped database failures are allowed. Keep the application logic on the tested path real. A callback at an integration's documented extension boundary is different from spying on its private implementation.

PDF examples read saved bytes with PDF.js, independently of the pdf-lib writer. Check text, geometry, annotations and attachments. CSV, ZIP and SEPA examples inspect the actual generated formats. Avoid whole-document binary snapshots and platform-sensitive pixel comparisons.

## State and property examples

The report transition table lives in `backend/tests/api/workflowStates.ts`: each state/action example creates its own report and reaches the starting state through HTTP. Forbidden transitions and insufficient roles must leave financial data unchanged. Long existing reimbursement stories are single AVA scenarios with named `t.try` steps; a failed step stops that story, rather than leaving independently registered tests dependent on a previous test's mutation.

`common/utils/money.properties.spec.ts` runs 500 cases per property, with bounded amounts, signed corrections, decimal rates and project assignments. Its rounding oracle uses integer ratios, not big.js or application helpers. Signed project expenses are conserved; negative project totals are flagged and their reimbursement is zero. Preserve concrete examples for half cents and other known regressions alongside these properties.

Fast-check prints a seed, replay path and shrunk counterexample on failure. Replay exactly one property:

```bash
docker compose run --rm --no-deps --pull never -e FC_SEED=123 -e FC_PATH='0:1' common \
  npx ava dist/utils/money.properties.spec.js --match='money: multiplication*'
```

Use the seed/path from the failure, after building common. Normal runs choose fresh seeds. Generated cases supplement specifications; they do not establish business rules or exhaust the input space.

## Running checks

Use Node 26 (>=26.12.1) and npm. Run package checks sequentially. Development dependencies live in bind-mounted `node_modules`: rebuild the affected development image after manifest changes. Starts synchronize dependencies only when the image changes or `node_modules/.dependency-id` is missing; remove that marker to repair a manually changed installation. Frontend validation requires Compose's repository mounts.

```bash
docker compose build common backend frontend ldap inbucket
docker compose run --rm --no-deps --pull never common npm test
docker compose run --rm --no-deps --pull never frontend npm test
docker compose run --rm --no-deps --pull never -e NODE_ENV=production frontend npm run build
docker compose up -d db redis ldap inbucket
docker compose run --rm --no-deps --pull never backend npm test
```

Common's test command builds it once; reuse that completed build for the other packages. Backend `npm test` builds once and then prepares LDAP fixtures before AVA. Do not prepend `npm run setup`. After a completed build, run an individual scenario or transition:

```bash
docker compose run --rm --no-deps --pull never backend npm run test:built -- \
  dist/tests/api/workflowStates.js --match='expenseReport: given review, examiner complete*'
```

Run Biome with the backend-pinned version, matching `biome.json`, the CI check and the pre-commit hook:

```bash
docker run --rm -v "$PWD:/code" --workdir /code ghcr.io/biomejs/biome:2.6.3 \
  ci --changed --error-on-warnings --no-errors-on-unmatched .
python3 dev-tools/tests/dependency-sync.py
```

## Production and browser checks

The production CI job builds immutable images, runs the existing backend upgrade and frontend smoke checks, then `.github/scripts/frontend-migration.sh`. That script installs nothing: its caller provides Playwright 1.64.1 with Chromium and Firefox, and `RUNNER_TEMP/frontend-migration/node_modules` must contain it. It copies the browser example modules there and exercises the actual previous/current frontend images. The HTTP fixtures simulate backend replies; they do not replace frontend code. Backend API tests cover the real backend separately.

For a local production validation, use separate image tags so the development images remain usable:

```bash
docker build -f frontend/Dockerfile.production -t abrechnung-test-frontend:production .
docker build -f backend/Dockerfile.production -t abrechnung-test-backend:production .
FRONTEND_IMAGE=abrechnung-test-frontend:production bash .github/scripts/frontend-smoke.sh
RUNNER_TEMP=/tmp/abrechnung-browser PREVIOUS_VERSION=2.6.3 \
  FRONTEND_IMAGE=abrechnung-test-frontend:production bash .github/scripts/frontend-migration.sh
```

Run the backend upgrade from a temporary directory with its own production environment and Compose project, as CI does. This avoids using the repository's development environment or a live deployment's database:

```bash
task_repo=$PWD
task_migration=$(mktemp -d /tmp/abrechnung-backend-migration.XXXXXX)
cp deploy-compose.yml "$task_migration/deploy-compose.yml"
cp .env.example "$task_migration/.env"
sed -i 's/^NODE_ENV=development$/NODE_ENV=production/' "$task_migration/.env"
(
  set -e
  cd "$task_migration"
  trap 'docker compose -p abrechnung-test-migration down --volumes' EXIT
  RUNNER_TEMP="$task_migration" PREVIOUS_VERSION=2.6.3 \
    BACKEND_IMAGE=abrechnung-test-backend:production COMPOSE_PROJECT_NAME=abrechnung-test-migration \
    bash "$task_repo/.github/scripts/backend-migration.sh"
)
```

The exit trap removes only this validation project's services and volumes, including after a failed check. The CI workflow supplies and cleans up its own environment.

## Data and failure isolation

Backend checks retain the configured development database. Shared users, settings, organisations and projects are restored. The test agent tracks IDs returned by its own mutations, protects IDs that already existed, and removes its own reports, history, receipts and other created entities on shutdown. Unrelated new records are not swept. Run backend suites serially and avoid concurrent manual edits to shared fixtures while they are being restored. Fixtures inserted directly must register their own exact-ID cleanup.

Redis examples use UUID-named queues and clean only those queues. Live exchange-rate provider calls are blocked in backend tests: seed dates/rates with `_exchangeRates.ts`; shutdown restores overwritten rates and removes newly seeded rates. Scope outage injection to its example and restore it in `finally`. Tests must not depend on provider availability, current rates, network timing or unrelated existing records.
