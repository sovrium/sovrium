# Dependency Risk Assessment

## Overview

**Purpose**: Architectural risk analysis for Sovrium's dependency stack — coupling depth measurement, risk tiers, and mitigation strategies.

**Scope**: Production dependencies only. Focuses on WHY risks matter architecturally and HOW they're mitigated. For concrete facts per dependency (versions, licenses, funding, alternatives), see `@docs/infrastructure/dependency-sustainability.md`.

**Last Reviewed**: 2026-03-03

---

## Risk Matrix

| Dependency         | Risk Level | Coupling Depth                | Replacement Cost | Mitigation                                    |
| ------------------ | ---------- | ----------------------------- | ---------------- | --------------------------------------------- |
| **Effect.ts**      | Medium     | Very Deep (277+ files)        | Very High        | Accepted risk (ADR-009), deep ecosystem value |
| **Better Auth**    | Medium     | Deep (auth is foundational)   | High             | Port/adapter pattern (Auth Context.Tag)       |
| **Drizzle ORM**    | Medium     | Moderate (7 repository ports) | Medium           | Repository ports abstract DB access           |
| **Bun**            | Medium     | Moderate (runtime APIs)       | Medium           | Standard APIs where possible                  |
| **React**          | Low        | Confined (presentation only)  | Medium           | Layer enforcement (eslint-plugin-boundaries)  |
| **Hono**           | Low        | Shallow (thin adapter)        | Low              | Standard Web API, easy to swap                |
| **Zod**            | Low        | Limited (API schemas + forms) | Low              | ADR-001 limits scope via ESLint               |
| **Tailwind CSS**   | Low        | Shallow (utility classes)     | Low              | Programmatic compiler abstracts direct usage  |
| **TanStack Query** | Low        | Shallow (hooks layer)         | Low              | Standard React patterns                       |
| **TanStack Table** | Low        | Shallow (headless)            | Low              | Standard React patterns                       |
| **Playwright**     | Low        | External (test infra only)    | Low              | No production coupling                        |

**Risk Level Definition**:

- **Medium**: VC-funded or pre-1.0; meaningful coupling; migration would require significant effort
- **Low**: Stable/mature; shallow coupling or layer-confined; migration tractable

---

## Tier 1: High Coupling

### Effect.ts (Accepted Strategic Risk)

**Coupling Analysis**

Effect.ts is used throughout `src/domain/` and `src/application/` (277+ files). It is not a library used for one feature — it is the execution model for the entire application layer:

- Effect Schema is the exclusive validation library for all domain/application/infrastructure code (ADR-009)
- Effect.gen drives all use-case workflows
- Effect Context.Tag defines all port interfaces in `src/application/ports/`
- Effect Layer provides all infrastructure implementations

**Why the Risk Is Accepted**

ADR-009 explicitly chose Effect Schema as the only permitted dependency in the domain layer. The ecosystem value justifies the coupling:

- Typed errors tracked at compile time (impossible to ignore failure cases)
- Built-in dependency injection via Context/Layer (no external DI framework)
- Structured concurrency (Fiber-based, safe parallel execution)
- Effect Schema handles validation, serialization, and type inference in one library

The alternative — a hybrid approach mixing multiple libraries — would introduce more complexity and coupling than accepting Effect's depth.

**Mitigation**

- Layer architecture concentrates Effect in domain and application layers. The presentation layer (Hono routes, React components) uses `async/await` and only calls `Effect.runPromise` at the boundary
- eslint-plugin-boundaries enforces this separation — Effect cannot leak into infrastructure adapters or presentation rendering logic

**Risk Factors**

- Talent scarcity: Effect developers are harder to hire than React or Express developers
- $2.275M seed funding — smaller runway than enterprise-backed alternatives
- Pre-1.0 API stability: minor version bumps have historically had breaking changes

**Contingency**

fp-ts + io-ts could replace core functional patterns. Effect Schema could be replaced by Zod (already used at the boundary). However, this would be a very significant migration touching 277+ files.

---

### Better Auth (Mitigated via Port/Adapter)

**Coupling Analysis**

Authentication is foundational — sessions, RBAC, middleware, and the admin plugin all depend on Better Auth. It is not easily isolated to one feature boundary.

**Mitigation**

Better Auth is abstracted behind an Effect Context.Tag service in `src/application/ports/`. The auth interface (get session, require session, require role) is defined as a port — application use-cases depend on the interface, not the Better Auth implementation. Swapping the implementation requires changing only `src/infrastructure/`.

**Risk Factors**

- $5M seed funding (Peak XV + YC backing) — open-core pivot risk, potential future feature gating behind commercial license
- Plugin ecosystem could diverge from core library stability

**Contingency**

Lucia Auth (MIT, no VC backing) could replace Better Auth behind the same port interface. The repository pattern for Better Auth's Drizzle adapter means schema changes are also isolated to infrastructure.

---

## Tier 2: Medium Coupling

### Drizzle ORM

**Coupling**

Drizzle ORM appears in 7 repository port implementations in `src/application/ports/repositories/`. The Drizzle schema definitions live in `src/infrastructure/database/drizzle/schema.ts` — infrastructure-only.

**Mitigation**

The repository pattern with Effect Context isolates database access. Application use-cases call repository ports (interfaces); Drizzle is the implementation. Swapping Drizzle means rewriting infrastructure implementations, not touching domain or application logic.

**Risk**

Pre-1.0 API stability. The bun:sql integration (`drizzle-orm/bun-sql`) is newer than the core library and may have distinct stability characteristics.

**Contingency**

Prisma or Kysely behind the same repository port interfaces. Schema migration to Prisma schema syntax would be the main effort.

---

### Bun

**Coupling**

Bun-specific APIs appear in several places: `bun:sql` for database connections, `Bun.file()` for file I/O, `Bun.serve()` for the HTTP server. The test runner (`bun:test`) is used across all unit tests.

**Mitigation**

Most application code uses standard Web APIs (fetch, Request/Response, URL, FormData). Bun-specific APIs are concentrated in infrastructure: `src/infrastructure/database/drizzle/db-bun.ts` (bun:sql), CLI file reading. eslint-plugin-boundaries prevents Bun-specific APIs from appearing in domain or application layers.

**Risk**

Bun is a young runtime (founded 2022). It is the sole runtime dependency — there is no fallback to Node.js in the current setup.

**Contingency**

Node.js + esbuild/tsx would require replacing `bun:sql` with `pg` or `postgres`, replacing `Bun.file()` with `node:fs/promises`, and replacing the Bun test runner with Vitest. The migration is tractable because Bun-specific APIs are infrastructure-confined.

---

### React

**Coupling**

React is confined to `src/presentation/` by eslint-plugin-boundaries (636 lines of boundary configuration in `eslint/boundaries.config.ts`). Domain and application layers have zero React imports.

**Mitigation**

Layer enforcement is the primary mitigation — the boundary configuration actively prevents React from leaking into business logic. React is also low-risk on its own (Meta-backed, dominant ecosystem, highly stable API).

**Risk**

Very low. Included here only because presentation-layer rewrites are non-trivial.

**Contingency**

Preact (drop-in API-compatible) for bundle size reduction. Solid.js would require presentation-layer rewrite but domain/application layers would be unaffected.

---

## Tier 3: Low Coupling / Low Risk

### Hono

Hono is a thin adapter layer in `src/presentation/api/`. It handles routing and request/response transformation. Routes call `Effect.runPromise` and convert results to standard `Response` objects. Built on standard Web APIs — swapping to Express or Fastify would require rewriting route handlers but no business logic changes.

### Zod

ADR-001 restricts Zod usage to `src/domain/models/api/` (OpenAPI contract schemas) and `src/presentation/` (React Hook Form client validation). ESLint `no-restricted-imports` rules enforce this boundary — Zod cannot be imported outside these locations. Because the scope is enforced, replacement is bounded.

### Tailwind CSS

The programmatic CSS compiler (`src/infrastructure/css/compiler.ts`) abstracts direct Tailwind dependency. Application code never imports Tailwind directly — it generates theme-aware CSS via the compiler service. Tailwind is a devDependency for the compiler internals.

### TanStack Query / TanStack Table

Standard React hooks patterns. Confined to `src/presentation/`. No Effect integration or domain coupling. Replacement would mean rewriting data-fetching hooks and table rendering components — a presentation concern only.

### Playwright

Test infrastructure only. No production code coupling. Replacement (e.g., Cypress, Puppeteer) would require rewriting `specs/` but has zero impact on `src/`.

---

## Architectural Mitigation Patterns

These patterns reduce the blast radius of dependency changes across the codebase:

### Port/Adapter Pattern (Effect Context.Tag)

Services are defined as interfaces (Context.Tag) in `src/application/ports/` and implemented in `src/infrastructure/`. Application use-cases depend only on the port interface — the infrastructure implementation is provided at runtime via Layer composition.

```
src/application/ports/repositories/UserRepository.ts  ← interface (Context.Tag)
src/infrastructure/database/repositories/UserRepositoryLive.ts  ← implementation (Layer)
```

This pattern applies to: database repositories, authentication, email, CSS compilation, logging.

**Effect on replacement cost**: Swapping an implementation means changing one infrastructure file and one Layer composition point — not touching use-cases or domain logic.

### Layer Enforcement (eslint-plugin-boundaries)

636 lines of boundary configuration in `eslint/boundaries.config.ts` define 21+ element types and enforce dependency direction. Framework-specific code cannot leak across layers:

- React confined to `src/presentation/`
- Drizzle confined to `src/infrastructure/`
- Effect allowed in `src/domain/`, `src/application/`, `src/infrastructure/`
- Bun-specific APIs confined to `src/infrastructure/`

**Effect on replacement cost**: A framework replacement only requires touching the layer where it's permitted — not the entire codebase.

### Dual Validation Strategy (ADR-001)

Zod is scoped to API contracts and client forms. Effect Schema handles all server-side validation. ESLint enforces this split via import restrictions. Each validation library is independently replaceable within its confined scope.

### Dependency Inversion (Application Ports)

The application layer defines what it needs (ports/interfaces); the infrastructure layer provides what exists (implementations). Domain layer has zero external dependencies except Effect Schema (ADR-009 accepted this explicitly). This inversion means:

- Domain logic can be tested without any infrastructure
- Infrastructure can be changed without touching domain logic
- New infrastructure implementations can be added without modifying use-cases

---

## Review Cadence

| Trigger                                   | Action                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| **Quarterly**                             | Check funding news, license changes, deprecation notices for Tier 1 and Tier 2 deps |
| **Annually**                              | Deep review of all tiers, evaluate alternatives, check community health metrics     |
| **VC funding announcement**               | Assess open-core pivot risk (Better Auth, Effect)                                   |
| **License change** (MIT → BSL/commercial) | Immediate assessment, contingency planning                                          |
| **Major CVE**                             | Security assessment, patch timeline evaluation                                      |
| **Maintainer departure**                  | Evaluate bus factor, consider forking or alternatives                               |
| **Acquisition news**                      | Assess strategic risk (vendor lock-in, support continuity)                          |

---

## Cross-References

- `@docs/infrastructure/dependency-sustainability.md` — Concrete dependency data (versions, licenses, funding, alternatives)
- [ADR-001: Validation Library Split](./decisions/001-validation-library-split.md) — Zod vs Effect Schema scoping, ESLint enforcement
- [ADR-005: Authorization Strategy](./decisions/005-authorization-strategy.md) — Better Auth integration, RBAC design
- [ADR-009: Effect Schema in Domain Layer](./decisions/009-effect-schema-in-domain-layer.md) — Accepted deep Effect coupling with rationale
- `@docs/architecture/layer-based-architecture.md` — Layer boundaries that contain coupling
- `@docs/architecture/functional-programming.md` — Effect.ts patterns (Tier 1 dependency)

---

**Last Updated**: 2026-03-03
**Maintained By**: architecture-docs-maintainer agent
