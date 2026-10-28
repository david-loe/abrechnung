# Repository rules

- Applies to `backend` (Express), `frontend` (Vue) and `common` (shared TypeScript).
- Prefer readability over cleverness.
- Keep code explicit, predictable, and easy to maintain.
- No fallback or legacy layers; use only current, clean, idiomatic solutions.
- Make focused changes; avoid unrelated refactors.
- Preserve existing architecture and conventions unless the task requires architectural changes.
- Performance matters: prefer solutions that keep runtime fast for end users.
- Preserve meaningful regression coverage when replacing tests; see [TESTING.md](TESTING.md) and [TEST-AUDIT.md](TEST-AUDIT.md).
- Prefer Docker Compose from the repo root
- Follow Biome and strict TypeScript
- Do not add explicit function return annotations; prefer static imports.
- Keep admin-only code out of the main frontend bundle through lazy loading.
- Branch from main; use Conventional Commits and do not rewrite reviewed history.
- PRs explain changes, benefits, drawbacks, risks and actual validation results.
- Never commit secrets, change tracked environment defaults or perform destructive operations without task authorization.
