# ADR 009: Effect Schema as Domain Layer Dependency

**Status**: Accepted
**Date**: 2026-01-29
**Decision Makers**: Architecture Review
**Related**: [Layer-Based Architecture (ADR-001)](./001-layer-based-architecture.md)

---

## Context

Sovrium follows a layer-based architecture with strict dependency rules:

```
Presentation → Application → Domain ← Infrastructure
```

### Domain Layer Principles

The Domain layer should be the **purest** layer:

- **No side effects** - Pure functions only
- **No I/O operations** - No database, network, or file system access
- **No external dependencies** - No npm packages (ideally)
- **Business logic only** - Validation rules, domain models, calculations

### The Paradox

**Effect Schema is an external dependency (`npm install effect`)**, yet Sovrium's domain layer uses it extensively:

```typescript
// src/domain/models/app/table/column.ts (300+ lines)
import { Schema } from 'effect'

export const ColumnSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  type: Schema.Literal('single-line-text', 'email', 'number' /* 30+ types */),
  required: Schema.optional(Schema.Boolean),
  unique: Schema.optional(Schema.Boolean),
})
```

**All domain models** use Effect Schema:

- `src/domain/models/app/table.ts`
- `src/domain/models/app/page.ts`
- `src/domain/models/app/theme.ts`
- `src/domain/validators/*.ts`

### Problem

Does Effect Schema violate the "Domain depends on NOTHING" principle? Should the domain layer be truly dependency-free?

---

## Decision

**We accept Effect Schema as the ONLY permitted external dependency in the Domain layer.**

### Rationale

Effect Schema is **not a typical external dependency** - it's a **type-level abstraction** that aligns with functional programming principles:

1. **Zero Runtime Overhead** - Schema definitions are compile-time constructs
2. **Declarative Validation** - Schema = data structure + validation rules (pure)
3. **Immutability Enforcement** - `readonly` types by default
4. **Composability** - Schemas compose like pure functions
5. **Type Safety** - Full TypeScript inference

**Effect Schema is to data what TypeScript is to JavaScript** - a type-level layer with minimal runtime cost.

---

## Rationale

### Why Effect Schema Belongs in Domain

#### 1. **Domain Models ARE Schema Definitions**

In traditional OOP, domain models are classes with methods:

```typescript
// Traditional OOP (NOT Sovrium)
class User {
  constructor(
    private id: number,
    private email: string,
    private name: string
  ) {}

  validate(): ValidationResult {
    if (!this.email.includes('@')) return { valid: false }
    return { valid: true }
  }
}
```

In functional programming (Sovrium), **domain models ARE schemas**:

```typescript
// Functional (Sovrium)
export const UserSchema = Schema.Struct({
  id: Schema.Number,
  email: Schema.String.pipe(Schema.pattern(/^[^@]+@[^@]+$/)),
  name: Schema.String,
})

export type User = typeof UserSchema.Type // Inferred
```

**The schema IS the domain model.** There's no separation.

#### 2. **Validation Logic Belongs in Domain**

Business rules are domain concerns:

```typescript
// src/domain/models/app/table/column.ts
export const ColumnSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9_]*$/), // Business rule: snake_case names
    Schema.minLength(1),
    Schema.maxLength(63) // PostgreSQL limit
  ),
  type: Schema.Literal('single-line-text', 'email' /* 30+ types */), // Business rule: allowed types
})
```

**Where else would this validation logic go?**

- Application layer? ❌ Business rules don't belong in orchestration
- Infrastructure layer? ❌ PostgreSQL limits are domain knowledge
- Presentation layer? ❌ UI shouldn't know database constraints

**Answer**: Domain layer is correct place, Effect Schema expresses it declaratively.

#### 3. **Type-Level Abstraction (Minimal Runtime)**

Effect Schema is primarily a **type system extension**:

```typescript
const UserSchema = Schema.Struct({
  id: Schema.Number, // Runtime: validator function (~5 lines)
  name: Schema.String, // Runtime: validator function (~3 lines)
})

// Most complexity is TYPE-LEVEL (zero runtime cost):
type User = typeof UserSchema.Type
// ↓ TypeScript infers
// { readonly id: number; readonly name: string }
```

**Runtime footprint is minimal** - just validation functions (pure, no side effects).

#### 4. **Declarative > Imperative**

Compare manual validation vs Effect Schema:

**Manual (Imperative)**:

```typescript
function validateUser(input: unknown): User | ValidationError {
  if (typeof input !== 'object' || input === null) {
    return new ValidationError('Input must be object')
  }
  const obj = input as Record<string, unknown>

  if (typeof obj.id !== 'number') {
    return new ValidationError('id must be number')
  }

  if (typeof obj.name !== 'string') {
    return new ValidationError('name must be string')
  }

  if (obj.name.length < 1 || obj.name.length > 100) {
    return new ValidationError('name must be 1-100 chars')
  }

  return { id: obj.id, name: obj.name }
}
```

**Effect Schema (Declarative)**:

```typescript
const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
})
```

**Declarative is more maintainable, testable, and readable.**

### Why NOT Pure TypeScript Types?

**TypeScript types are erased at runtime** - they can't validate untrusted input:

```typescript
// TypeScript type (compile-time only)
type User = {
  id: number
  name: string
}

// This compiles but crashes at runtime:
const user: User = JSON.parse(apiResponse) // Runtime: { id: "not a number" }
console.log(user.id + 1) // NaN (silent bug!)
```

**Effect Schema provides runtime validation**:

```typescript
const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
})

const decoded = Schema.decodeUnknownSync(UserSchema)(apiResponse)
// ✅ Runtime validation: throws if id is not a number
```

**Domain layer needs runtime validation for:**

- API inputs (JSON from client)
- Configuration files (YAML/JSON)
- Database queries (untrusted data)

---

## Consequences

### Positive Consequences

✅ **Single Source of Truth** - Schema defines types, validation, and documentation
✅ **Composable** - Schemas compose like pure functions
✅ **Type-Safe** - Full TypeScript inference, no manual type duplication
✅ **Declarative** - Business rules expressed clearly, not buried in imperative code
✅ **Immutable by Default** - `readonly` types prevent accidental mutation
✅ **Effect Ecosystem** - Seamless integration with Effect.ts error handling
✅ **Future-Proof** - Schema evolution (migrations, versioning) built-in
✅ **Testable** - Schema validation is pure, easy to test

### Negative Consequences

❌ **External Dependency** - Domain layer depends on Effect npm package
→ **Accepted Trade-off**: Benefits far outweigh dependency concern

❌ **Framework Lock-In** - Changing schema library requires domain refactor
→ **Mitigation**: Effect is stable (v3.x), unlikely to need replacement

❌ **Learning Curve** - Developers must learn Effect Schema syntax
→ **Mitigation**: Syntax is intuitive, similar to Zod/Yup

❌ **Bundle Size** - Effect adds ~50KB to bundle
→ **Accepted**: Sovrium is server-side, bundle size not critical

### Architectural Trade-Off

**Strict Purity** vs **Pragmatic Functionality**:

- **Strict**: Domain has ZERO dependencies, all validation manual
- **Pragmatic**: Domain has ONE dependency (Effect Schema), validation declarative

**We choose Pragmatic** - the productivity and safety gains justify the dependency.

---

## Alternatives Considered

### Alternative A: Manual Validation Functions

**Approach**: Write pure TypeScript validation functions without Effect Schema

```typescript
// No Effect Schema
function validateUser(
  input: unknown
): { valid: true; data: User } | { valid: false; error: string } {
  // 50+ lines of manual validation
}
```

**Rejected Because**:

- ❌ **Verbose** - 10x more code than Schema definitions
- ❌ **Error-Prone** - Manual type guards are fragile
- ❌ **Hard to Compose** - Can't compose validators like schemas
- ❌ **No Type Inference** - Must manually define types + validators

### Alternative B: Zod for Domain Validation

**Approach**: Use Zod instead of Effect Schema

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100),
})
```

**Rejected Because**:

- ❌ **Effect Ecosystem** - Sovrium uses Effect.ts, Zod doesn't integrate
- ❌ **Error Handling** - Zod throws exceptions, Effect uses typed errors
- ❌ **Two Schema Libraries** - Already use Zod for OpenAPI, don't want duplication in domain
- ✅ **Zod Kept for OpenAPI** - Presentation layer (API schemas) only

**Architecture Decision**: Effect Schema for server (domain/application/infrastructure), Zod for client (OpenAPI schemas)

### Alternative C: No Runtime Validation

**Approach**: Trust TypeScript types, no runtime checks

```typescript
type User = {
  id: number
  name: string
}

const user: User = JSON.parse(apiResponse) // Hope it's valid!
```

**Rejected Because**:

- ❌ **Unsafe** - Runtime data can violate type contracts
- ❌ **Silent Bugs** - Invalid data causes crashes deep in code
- ❌ **No Fail-Fast** - Errors detected late, hard to debug

### Alternative D: JSON Schema

**Approach**: Use JSON Schema standard for validation

**Rejected Because**:

- ❌ **Not Type-Safe** - JSON Schema separate from TypeScript types
- ❌ **Verbose** - JSON syntax more verbose than Effect Schema
- ❌ **Poor DX** - No autocomplete, no type inference
- ❌ **External Validator** - Requires AJV or similar library

---

## ESLint Enforcement

**Current State**: `eslint/boundaries.config.ts` allows Effect Schema in domain:

```typescript
// Line 275: Domain layer import rules
{
  target: 'domain-model',
  allow: ['domain-*'],
  disallow: [
    'application-*',
    'infrastructure-*',
    'presentation-*',
  ],
}
```

**Effect Schema imports are NOT restricted** - implicitly allowed.

**Explicit Allowlist** (future improvement):

```typescript
{
  target: 'domain-*',
  allow: [
    'domain-*', // Internal domain imports
    ({ dependency }) => dependency.includes('effect/Schema'), // ONLY Effect Schema
  ],
  disallow: [
    'application-*',
    'infrastructure-*',
    'presentation-*',
    ({ dependency }) => !dependency.includes('effect/Schema') && dependency.startsWith('effect/'), // No other Effect imports
  ],
}
```

**Implementation**: Defer to separate PR for ESLint rule refinement

---

## Implementation Status

### Current Usage (January 2026)

Effect Schema is pervasive in domain:

- ✅ `src/domain/models/app/table.ts` - Table schema with 30+ field types
- ✅ `src/domain/models/app/page.ts` - Page schema with sections/blocks
- ✅ `src/domain/models/app/theme.ts` - Theme schema with colors/fonts
- ✅ `src/domain/models/app/auth.ts` - Auth schema with method validation
- ✅ `src/domain/validators/*.ts` - Business rule validators

**Total**: 15+ files, 2000+ lines of Schema definitions

### Best Practices

**DO** use Effect Schema for:

- Domain model definitions (TableSchema, PageSchema, etc.)
- Business rule validation (email patterns, length constraints)
- Configuration parsing (JSON/YAML to typed objects)

**DON'T** use Effect Schema for:

- Side effects (database queries, API calls) - Use Application/Infrastructure layers
- UI validation (form inputs) - Use Zod + React Hook Form in Presentation layer
- Non-validation logic - Keep domain functions pure

---

## Review Date

**2026-07-29** (6 months)

### Review Questions

1. Has Effect Schema v4 introduced breaking changes?
2. Are developers comfortable with Effect Schema syntax?
3. Should we reconsider Zod for domain (Effect ecosystem too complex)?
4. Has bundle size become a concern (Effect Schema footprint)?
5. Are there new validation libraries worth considering?

---

## References

- [Effect Schema Documentation](https://effect.website/docs/schema)
- [Layer-Based Architecture (ADR-001)](./001-layer-based-architecture.md)
- [Validation Library Split (ADR-001 in old numbering)](./001-validation-library-split.md)
- [Domain Models in src/domain/models/](../../domain/models/)
- [Effect.ts Documentation](https://effect.website/docs)
- [Zod Documentation](https://zod.dev/) (for comparison)
