# Infrastructure Docs Maintainer Memory

## Documentation State

| Doc File | Quality | Notes |
|----------|---------|-------|
| `docs/infrastructure/runtime/bun.md` | Good | Version updated 1.3.9→1.3.10 |
| `docs/infrastructure/language/typescript.md` | Good | Removed false tsc wrapper v2.0.4 claim; target string vs array fixed |
| `docs/infrastructure/quality/eslint.md` | Good | Versions updated (9.39.1→9.39.2, typescript-eslint updated) |
| `docs/infrastructure/quality/prettier.md` | Good | Version 3.7.3→^3.8.1 |
| `docs/infrastructure/quality/knip.md` | Good | Version 5.71.0→^5.85.0 |
| `docs/infrastructure/framework/effect.md` | Good | Version ^3.19.16→^3.19.19; language-service 0.73.1→0.74.0 |
| `docs/infrastructure/framework/hono.md` | Good | Version ^4.11.9→^4.12.3 |
| `docs/infrastructure/framework/better-auth.md` | Good | Version ^1.4.18→^1.4.19 |
| `docs/infrastructure/database/drizzle.md` | Good | Removed false dual-driver arch; fixed layer path (src/db→src/infrastructure/database/drizzle); fixed schema path |
| `docs/infrastructure/testing/bun-test.md` | Good | Removed non-existent scripts test:unit:watch, test:unit:coverage; fixed --concurrent claim |
| `docs/infrastructure/ui/tailwind.md` | Good | Version ^4.1.18→^4.2.1 |
| `docs/infrastructure/ui/tanstack-query.md` | Good | Version ^5.90.20→^5.90.21 |
| `docs/infrastructure/api/zod-hono-openapi.md` | Good | @hono/zod-openapi 1.2.1→^1.2.2; fixed ESLint rule description (3 rules not 2) |

## Version Tracking

Last verified against package.json (bun@1.3.10):
- Bun: 1.3.10 (packageManager field)
- TypeScript: ^5.9.3 (direct install, no wrapper)
- Effect: ^3.19.19
- @effect/language-service: 0.74.0
- @effect/experimental: ^0.58.0
- Hono: ^4.12.3
- Better Auth: ^1.4.19
- Drizzle ORM: ^0.45.1, drizzle-kit: ^0.31.9
- React: ^19.2.4
- Tailwind CSS: ^4.2.1, @tailwindcss/postcss: ^4.2.1
- TanStack Query: ^5.90.21, devtools: ^5.91.3
- TanStack Table: ^8.21.3
- Zod: ^4.3.6
- @hono/zod-openapi: ^1.2.2
- ESLint: 9.39.2
- Prettier: ^3.8.1
- Knip: ^5.85.0

## Common Documentation Mistakes Found

1. **Fictional dual-driver architecture**: drizzle.md claimed db-node.ts for Node.js compat - doesn't exist
2. **Non-existent scripts**: bun-test.md referenced test:unit:watch, test:unit:coverage - don't exist
3. **Wrong --concurrent claim**: test:unit script does NOT use --concurrent (only test:unit:concurrent does)
4. **Wrong paths**: drizzle.md used src/db/layer.ts and src/db/schema - actual is src/infrastructure/database/drizzle/
5. **False tsc wrapper**: typescript.md claimed tsc v2.0.4 wrapper package - TypeScript is installed directly

## Key File Paths

- Drizzle DB entry: `src/infrastructure/database/drizzle/db.ts` (re-exports from db-bun.ts)
- Drizzle Bun driver: `src/infrastructure/database/drizzle/db-bun.ts`
- Effect Layer: `src/infrastructure/database/drizzle/layer.ts`
- Drizzle Schema (single file): `src/infrastructure/database/drizzle/schema.ts`
- Drizzle config schema path: `./src/infrastructure/database/drizzle/schema.ts`
- ESLint modular configs: `eslint/` directory (16 files), main `eslint.config.ts` is ~44 lines
- Zod restrictions: `eslint/infrastructure.config.ts` (3 rules: restriction + 2 exceptions)

## Token Optimization Notes

- CLAUDE.md verified under 500 lines after all updates
- Detailed docs remain in docs/infrastructure/ for on-demand loading
- Docs are cross-referenced with @docs/ syntax in CLAUDE.md
