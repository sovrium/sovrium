# Dependency Sustainability Reference

**Purpose**: Concrete dependency data for sustainability review and contingency planning. This document records factual information about each major Sovrium dependency — versions, licenses, backing, release cadence, and alternatives.

**Cross-reference**: `@docs/architecture/dependency-risk-assessment.md` for architectural risk analysis and mitigation strategies.

---

## Version Pinning Strategy

Sovrium uses the following version management approach:

| Mechanism               | Details                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Caret ranges (`^`)**  | Most dependencies use `^` in `package.json`, allowing non-breaking minor and patch updates within the declared major version                                   |
| **Binary lock file**    | `bun.lock` records exact resolved versions for all dependencies and is committed to version control                                                            |
| **CI frozen lockfile**  | CI runs `bun install --frozen-lockfile`, preventing accidental version drift in automated environments                                                         |
| **Bun runtime pinning** | Bun is pinned to exact version `1.3.10` via the `packageManager` field in `package.json`; CI uses `bun-version-file: package.json` with `oven-sh/setup-bun@v2` |

---

## Core Runtime & Language

### Bun 1.3.10

| Field                   | Value                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| **Current Version**     | `1.3.10` (exact pin via `packageManager`)                                                         |
| **License**             | MIT                                                                                               |
| **Funding / Backing**   | Oven, Inc. (VC-backed, $14M+ raised, Series A)                                                    |
| **Maintainer Count**    | Small team (~20 engineers at Oven)                                                                |
| **Release Cadence**     | Frequent (multiple releases per month)                                                            |
| **API Stability**       | Maturing — Node.js compat layer stable, Bun-native APIs still evolving                            |
| **Upgrade Risk**        | Medium — runtime-specific APIs (`bun:sql`, `Bun.file`, `Bun.serve`) require testing after upgrade |
| **Primary Alternative** | Node.js + esbuild + tsx                                                                           |

**Notes**: Bun is the deepest runtime coupling in the project. `bun:sql` is used directly by Drizzle ORM (`drizzle-orm/bun-sql`). `Bun.file()` is used in the CSS compiler and CLI. Upgrading requires regression testing of database, file I/O, and test runner behavior.

---

### TypeScript ^5.9.3

| Field                   | Value                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **Current Version**     | `^5.9.3`                                                                                                  |
| **License**             | Apache 2.0                                                                                                |
| **Funding / Backing**   | Microsoft (corporate-backed, large engineering team)                                                      |
| **Maintainer Count**    | Large team (30+ TypeScript team members at Microsoft)                                                     |
| **Release Cadence**     | Quarterly (major versions), monthly (patch releases)                                                      |
| **API Stability**       | Stable — backwards-compatible within major version                                                        |
| **Upgrade Risk**        | Low — minor strictness increases possible between minors; project uses `noEmit: true` so no emit pipeline |
| **Primary Alternative** | None (de facto standard for typed JavaScript)                                                             |

**Notes**: TypeScript is a devDependency used exclusively for type checking (`tsc --noEmit --incremental`). Bun handles execution. No emit pipeline exists, so upgrade risk is limited to type-checking behavior changes.

---

## Core Frameworks

### Effect ^3.19.19

| Field                   | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Current Version**     | `^3.19.19`                                                                                                 |
| **License**             | MIT                                                                                                        |
| **Funding / Backing**   | Effectful Technologies (VC-backed, ~$2.275M seed from Amplify Partners)                                    |
| **Maintainer Count**    | Small team (core team of ~5, active contributor community)                                                 |
| **Release Cadence**     | Weekly (minor and patch releases are very frequent)                                                        |
| **API Stability**       | Maturing — Effect 3.x API is stable; ecosystem packages (`@effect/platform`, `@effect/cli`) still evolving |
| **Upgrade Risk**        | Medium — ecosystem packages occasionally have breaking changes between minors                              |
| **Primary Alternative** | fp-ts + io-ts (significant rewrite required)                                                               |

**Packages in use**:

| Package                    | Version    | Purpose                                        |
| -------------------------- | ---------- | ---------------------------------------------- |
| `effect`                   | `^3.19.19` | Core runtime, Schema, Context, Layer           |
| `@effect/experimental`     | `^0.58.0`  | DevTools layer                                 |
| `@effect/platform`         | `^0.94.5`  | HTTP platform abstractions                     |
| `@effect/platform-bun`     | `^0.87.1`  | Bun-specific platform bindings                 |
| `@effect/cli`              | `^0.73.2`  | CLI command framework                          |
| `@effect/language-service` | `0.77.0`   | TypeScript language service plugin (exact pin) |
| `@effect/eslint-plugin`    | `^0.3.2`   | ESLint rules for Effect patterns               |

**Notes**: Effect is the deepest framework coupling in Sovrium — used in 277+ domain files across all four architectural layers. The weekly release cadence means `bun.lock` updates are frequent. `@effect/language-service` is pinned to an exact version (`0.77.0`) because it directly affects the TypeScript language service behavior in IDEs.

---

### Hono ^4.12.3

| Field                   | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| **Current Version**     | `^4.12.3`                                                                    |
| **License**             | MIT                                                                          |
| **Funding / Backing**   | Cloudflare (primary employer of creator Yusuke Wada; community contributors) |
| **Maintainer Count**    | Small team (Yusuke Wada + ~10 active contributors)                           |
| **Release Cadence**     | Weekly (very active development)                                             |
| **API Stability**       | Stable — v4 API has been stable since release; middleware API consistent     |
| **Upgrade Risk**        | Low — thin presentation layer, minimal custom middleware                     |
| **Primary Alternative** | Express, Fastify                                                             |

**Packages in use**:

| Package                      | Version   | Purpose                            |
| ---------------------------- | --------- | ---------------------------------- |
| `hono`                       | `^4.12.3` | Web framework, routing, SSR        |
| `@hono/zod-openapi`          | `^1.2.2`  | OpenAPI schema generation with Zod |
| `@hono/zod-validator`        | `^0.7.6`  | Request validation middleware      |
| `@scalar/hono-api-reference` | `^0.9.47` | API reference UI from OpenAPI spec |

---

### Better Auth ^1.5.1

| Field                   | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Current Version**     | `^1.5.1`                                                                            |
| **License**             | MIT                                                                                 |
| **Funding / Backing**   | $5M seed (Peak XV Partners + Y Combinator, 2024)                                    |
| **Maintainer Count**    | Small team (Bereket Thomas + ~5 core contributors)                                  |
| **Release Cadence**     | Weekly (very active; v1.4.x had rapid feature additions)                            |
| **API Stability**       | Maturing — v1.x API is usable but plugin API still evolving                         |
| **Upgrade Risk**        | Medium — auth is foundational; session/cookie behavior changes need careful testing |
| **Primary Alternative** | Lucia Auth, Auth.js (NextAuth)                                                      |

**Notes**: Better Auth manages user sessions, OAuth, and the `drizzleAdapter` for auth tables. The `admin` plugin and session configuration are project-specific. Minor version upgrades have historically added breaking plugin changes. The session `freshAge` behavior (added in v1.4.7) requires verification after upgrades.

---

### Drizzle ORM ^0.45.1

| Field                   | Value                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| **Current Version**     | `^0.45.1` (drizzle-orm), `^0.31.9` (drizzle-kit)                                                    |
| **License**             | Apache 2.0                                                                                          |
| **Funding / Backing**   | Drizzle Team (bootstrapped; no disclosed external funding)                                          |
| **Maintainer Count**    | Small team (Aleksandr Blokh + ~3 core contributors)                                                 |
| **Release Cadence**     | Weekly (very active development)                                                                    |
| **API Stability**       | Maturing — pre-1.0; API surface has been largely stable since v0.30; `bun-sql` driver added v0.39.0 |
| **Upgrade Risk**        | Medium — pre-1.0 versioning; `bun:sql` driver integration is non-standard                           |
| **Primary Alternative** | Prisma, Kysely                                                                                      |

**Notes**: Sovrium uses the `drizzle-orm/bun-sql` driver (native `bun:sql` module, no external PostgreSQL driver). This driver is Bun-specific and was introduced in drizzle-orm v0.39.0. Both `drizzle-orm` and `drizzle-kit` must be upgraded together to avoid schema generation mismatches. The single schema file lives at `src/infrastructure/database/drizzle/schema.ts`.

---

## Validation

### Zod ^4.3.6

| Field                   | Value                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Current Version**     | `^4.3.6`                                                                                 |
| **License**             | MIT                                                                                      |
| **Funding / Backing**   | Community (Colin McDonnell, creator)                                                     |
| **Maintainer Count**    | Solo maintainer with active community contributors                                       |
| **Release Cadence**     | Monthly (v4 is a recent rewrite; previously very stable)                                 |
| **API Stability**       | Stable (v4 rewrite completed; new `z.strictObject` and pipeline changes are settled)     |
| **Upgrade Risk**        | Low — usage is intentionally limited to `src/domain/models/api/` and `src/presentation/` |
| **Primary Alternative** | Valibot, Yup                                                                             |

**Notes**: Zod usage is strictly scoped by ESLint enforcement (`eslint/infrastructure.config.ts`). It is used only for OpenAPI contract schemas (`@hono/zod-openapi`) and client-side form validation (`@hookform/resolvers`). All server-side and domain validation uses Effect Schema. This limited scope reduces upgrade risk significantly.

---

## UI & Frontend

### React ^19.2.4

| Field                   | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Current Version**     | `^19.2.4` (react + react-dom)                                                      |
| **License**             | MIT                                                                                |
| **Funding / Backing**   | Meta (Facebook), large engineering team                                            |
| **Maintainer Count**    | Large team (Meta React core team, 10+ engineers)                                   |
| **Release Cadence**     | Quarterly (major versions every 1-2 years; patch releases as needed)               |
| **API Stability**       | Stable — React 19 is a stable release; hooks API unchanged                         |
| **Upgrade Risk**        | Low — React is confined to the presentation layer; SSR via Hono's `renderToString` |
| **Primary Alternative** | Preact, Solid.js                                                                   |

**Notes**: Sovrium uses React 19 for SSR (Hono + `renderToString`). The React Compiler (`babel-plugin-react-compiler`) is NOT used — Bun does not yet support it. Manual memoization is therefore still required for performance-critical components.

---

### Tailwind CSS ^4.2.1

| Field                   | Value                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| **Current Version**     | `^4.2.1` (tailwindcss + `@tailwindcss/postcss`)                                                    |
| **License**             | MIT                                                                                                |
| **Funding / Backing**   | Tailwind Labs (profitable bootstrapped company)                                                    |
| **Maintainer Count**    | Small team (Adam Wathan + ~5 core team members)                                                    |
| **Release Cadence**     | Quarterly (v4 is a recent complete rewrite)                                                        |
| **API Stability**       | Stable — v4 rewrite complete; `@theme` directive and CSS-first config are settled                  |
| **Upgrade Risk**        | Low — CSS compilation is abstracted by the custom compiler in `src/infrastructure/css/compiler.ts` |
| **Primary Alternative** | UnoCSS                                                                                             |

**Notes**: Sovrium uses a custom programmatic CSS compiler (`src/infrastructure/css/compiler.ts`) rather than static PostCSS configuration files. Tailwind is invoked programmatically via the PostCSS plugin API. The `tw-animate-css` package provides pre-built animation classes.

---

### TanStack Query ^5.90.21

| Field                   | Value                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Current Version**     | `^5.90.21` (react-query), `^5.91.3` (react-query-devtools)                           |
| **License**             | MIT                                                                                  |
| **Funding / Backing**   | Community (Tanner Linsley, creator; open-source sponsors)                            |
| **Maintainer Count**    | Solo maintainer + active contributor community (~10 regular contributors)            |
| **Release Cadence**     | Monthly (v5 is the current stable major)                                             |
| **API Stability**       | Stable — v5 released 2023; `useQuery`, `useMutation`, `useInfiniteQuery` API settled |
| **Upgrade Risk**        | Low — standard hooks API, no deep coupling                                           |
| **Primary Alternative** | SWR                                                                                  |

---

### TanStack Table ^8.21.3

| Field                   | Value                                                     |
| ----------------------- | --------------------------------------------------------- |
| **Current Version**     | `^8.21.3`                                                 |
| **License**             | MIT                                                       |
| **Funding / Backing**   | Community (Tanner Linsley, creator; open-source sponsors) |
| **Maintainer Count**    | Solo maintainer + active contributor community            |
| **Release Cadence**     | Monthly                                                   |
| **API Stability**       | Stable — v8 API has been stable for 2+ years              |
| **Upgrade Risk**        | Low — headless library, no DOM coupling                   |
| **Primary Alternative** | AG Grid (open-source tier)                                |

---

### React Hook Form ^7.71.2

| Field                   | Value                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| **Current Version**     | `^7.71.2` (react-hook-form), `^5.2.2` (@hookform/resolvers)          |
| **License**             | MIT                                                                  |
| **Funding / Backing**   | Community (Bill Luo, creator; open-source sponsors)                  |
| **Maintainer Count**    | Small team (~3 core contributors)                                    |
| **Release Cadence**     | Monthly                                                              |
| **API Stability**       | Stable — v7 API unchanged for 3+ years                               |
| **Upgrade Risk**        | Low — limited to `src/presentation/` for client-side form validation |
| **Primary Alternative** | Formik, TanStack Form                                                |

---

## Testing

### Playwright ^1.58.2

| Field                   | Value                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Current Version**     | `^1.58.2`                                                                               |
| **License**             | Apache 2.0                                                                              |
| **Funding / Backing**   | Microsoft (corporate-backed, dedicated team)                                            |
| **Maintainer Count**    | Large team (Microsoft, 15+ engineers)                                                   |
| **Release Cadence**     | Monthly (very regular releases with browser updates)                                    |
| **API Stability**       | Stable — API has been consistent since v1.20; ARIA snapshot API added v1.41             |
| **Upgrade Risk**        | Low — upgrades primarily bundle new browser binaries; API changes are rare and additive |
| **Primary Alternative** | Cypress, Puppeteer                                                                      |

**Notes**: Playwright is used for all E2E tests in the `specs/` directory. ARIA snapshots (`toMatchAriaSnapshot`) and visual screenshots (`toHaveScreenshot`) are stored in `specs/**/__snapshots__/`. Browser binaries must be reinstalled after version upgrades (`bunx playwright install`).

---

## Utilities

| Dependency       | Version         | License              | Backing                                | Stability | Notes                                                         |
| ---------------- | --------------- | -------------------- | -------------------------------------- | --------- | ------------------------------------------------------------- |
| `nodemailer`     | `8.0.1` (exact) | MIT                  | Community (Andris Reinman, solo)       | Stable    | Exact pin due to v8 API changes; used for SMTP email sending  |
| `dompurify`      | `^3.3.1`        | Apache 2.0 / MPL 2.0 | Community (Cure53 security firm)       | Stable    | HTML sanitization; dual-licensed; security-critical           |
| `nanoid`         | `^5.1.6`        | MIT                  | Community (Andrey Sitnik, solo)        | Stable    | Unique ID generation; ESM-only since v4                       |
| `js-yaml`        | `^4.1.1`        | MIT                  | Community                              | Stable    | YAML parsing in CLI only; no serialization used               |
| `lucide-react`   | `^0.575.0`      | ISC                  | Community (fork of Feather Icons)      | Stable    | Icon library; each icon is a separate export (tree-shakeable) |
| `jiti`           | `^2.6.1`        | MIT                  | Community (Pooya Parsa)                | Stable    | Runtime TypeScript execution for config loading               |
| `postcss`        | `^8.5.8`        | MIT                  | Community (Andrey Sitnik + Eva Minich) | Stable    | Required by Tailwind CSS programmatic compiler                |
| `tw-animate-css` | `^1.4.0`        | MIT                  | Community                              | Stable    | Pre-built animation classes for Tailwind v4                   |

---

## Dev Dependencies

| Dependency                   | Version          | License    | Backing                        | Stability | Notes                                                |
| ---------------------------- | ---------------- | ---------- | ------------------------------ | --------- | ---------------------------------------------------- |
| `eslint`                     | `9.39.2` (exact) | MIT        | OpenJS Foundation              | Stable    | Exact pin for reproducibility; v9 flat config format |
| `typescript-eslint`          | `^8.56.1`        | MIT        | typescript-eslint team         | Stable    | TypeScript-aware lint rules                          |
| `prettier`                   | `^3.8.1`         | MIT        | Community                      | Stable    | Code formatter; config in `.prettierrc.json`         |
| `knip`                       | `^5.85.0`        | MIT        | Community (Lars Kappert, solo) | Stable    | Unused code/dependency detection                     |
| `semantic-release`           | `^25.0.3`        | MIT        | Community                      | Stable    | Automated release management                         |
| `drizzle-kit`                | `^0.31.9`        | Apache 2.0 | Drizzle Team                   | Maturing  | Must be upgraded in sync with `drizzle-orm`          |
| `@playwright/test`           | `^1.58.2`        | Apache 2.0 | Microsoft                      | Stable    | Test runner for E2E specs                            |
| `@testcontainers/postgresql` | `^11.12.0`       | MIT        | AtomicJar / Docker Inc.        | Stable    | PostgreSQL test containers                           |

---

## Migration Alternatives Matrix

Summary of effort required to replace each critical dependency if needed:

| Dependency         | Primary Alternative | Migration Effort | Key Constraint                                                                               |
| ------------------ | ------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| **Effect.ts**      | fp-ts + io-ts       | Very High        | 277+ domain files; Schema, Context, Layer, gen syntax throughout all 4 layers                |
| **Better Auth**    | Lucia Auth          | High             | Auth is foundational; session management, `drizzleAdapter`, admin plugin all require porting |
| **Drizzle ORM**    | Prisma              | Medium           | 7+ repository ports abstract DB access; schema format differs significantly                  |
| **Hono**           | Express / Fastify   | Low              | Thin presentation layer; routes use standard Request/Response; middleware is minimal         |
| **Bun**            | Node.js + esbuild   | Medium           | `bun:sql` (PostgreSQL driver), `Bun.file()` (CSS compiler, CLI), built-in test runner        |
| **React**          | Preact / Solid.js   | Medium           | Confined to `src/presentation/`; SSR via `renderToString` would need adapter                 |
| **Zod**            | Valibot             | Low              | Limited scope — API schemas in `src/domain/models/api/` and forms in `src/presentation/`     |
| **Tailwind CSS**   | UnoCSS              | Low              | Utility classes; programmatic compiler is abstracted in `src/infrastructure/css/compiler.ts` |
| **TanStack Query** | SWR                 | Low              | Standard hooks API; no deep coupling beyond `useQuery` / `useMutation`                       |
| **TanStack Table** | AG Grid (OSS)       | Low              | Headless library; markup and styling are fully controlled by Sovrium components              |
| **Playwright**     | Cypress             | Medium           | ARIA snapshot format and visual snapshot storage differ between tools                        |
| **TypeScript**     | None                | N/A              | De facto standard; no viable alternative                                                     |

---

## Review Cadence

| Review Type                    | Frequency  | Trigger                                                                                                                 |
| ------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Routine version review**     | Quarterly  | Check for deprecation notices, new majors, abandoned packages                                                           |
| **Deep sustainability review** | Annual     | Evaluate community health, funding status, API stability trajectory                                                     |
| **Immediate review**           | On trigger | Funding announcement (raise or shutdown), license change, critical CVE, maintainer departure, major API breaking change |

**Recommended quarterly checks**:

1. Run `bun update --dry-run` to see available updates
2. Check GitHub Pulse for each critical dependency (commits, issues, PRs)
3. Verify no license changes via `license-checker` or similar tool
4. Check npm weekly download trends for significant drops

---

## Cross-References

- `@docs/architecture/dependency-risk-assessment.md` — Architectural risk analysis and mitigation strategies per dependency
- ESLint Zod restriction rules: `eslint/infrastructure.config.ts` (enforces Zod scope boundaries)
- CSS compiler: `src/infrastructure/css/compiler.ts` (Tailwind programmatic integration)
- Database entry point: `src/infrastructure/database/drizzle/db.ts` (Drizzle + bun:sql)

---

_Last Updated: 2026-03-03_
