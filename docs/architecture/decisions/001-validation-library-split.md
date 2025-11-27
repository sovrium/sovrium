# ADR-001: Validation Library Split (Effect Schema vs Zod)

## Status

Accepted

## Context

Sovrium requires robust data validation at multiple layers:

1. **Domain models** - Core business logic validation
2. **API contracts** - HTTP request/response validation
3. **Client forms** - Browser-side form validation
4. **OpenAPI specs** - API documentation generation

We needed to choose between using a single validation library everywhere or splitting based on specific use cases.

## Decision

We will use **two different validation libraries** based on context:

1. **Effect Schema** for domain models (`src/domain/models/app/`)
2. **Zod** for API contracts and client forms (`src/presentation/api/schemas/`)

## Rationale

### Why Effect Schema for Domain Models

1. **Effect Ecosystem Integration**: Domain models integrate with Effect.ts for dependency injection, error handling, and orchestration
2. **Better Type Inference**: Effect Schema provides superior TypeScript inference for complex nested structures
3. **Functional Programming Alignment**: Effect Schema follows FP principles with immutability and composability
4. **Declarative Transformations**: Built-in support for data transformations and refinements
5. **Performance**: Compile-time optimizations for validation logic

### Why Zod for API/Client

1. **OpenAPI Generation**: `@hono/zod-openapi` requires Zod schemas for automatic OpenAPI spec generation
2. **React Hook Form**: Best-in-class integration with `@hookform/resolvers/zod`
3. **Client Bundle Size**: Zod is lighter for client-side bundles when Effect isn't needed
4. **Industry Standard**: Widely adopted for API validation in the TypeScript ecosystem
5. **Simple Learning Curve**: Familiar API for developers coming from other projects

### Why Not a Single Library

We considered using only one library but found critical limitations:

**Effect Schema Everywhere**:

- ❌ No OpenAPI generation support
- ❌ Poor React Hook Form integration
- ❌ Larger client bundle when full Effect isn't needed

**Zod Everywhere**:

- ❌ Poor integration with Effect.ts ecosystem
- ❌ Less powerful type inference for complex domain models
- ❌ Missing advanced FP patterns we need in domain layer

## Consequences

### Positive

- ✅ Best tool for each job - optimal for both use cases
- ✅ Clean separation of concerns (domain vs presentation)
- ✅ Excellent developer experience in both contexts
- ✅ Type-safe OpenAPI generation works out of the box
- ✅ Smaller client bundles (Zod only where needed)

### Negative

- ❌ Two libraries to learn and maintain
- ❌ Potential for confusion about which to use where
- ❌ Cannot share validation schemas between layers
- ❌ Duplicate validation logic in some cases

### Mitigation Strategies

1. **Clear Directory Structure**:
   - `app/` = Effect Schema only
   - `api/` = Zod only

2. **ESLint Enforcement**: Rules prevent wrong library usage in wrong location

3. **Documentation**: Clear guidelines in `docs/infrastructure/validation/zod.md`

4. **Code Generation**: Consider generating Zod schemas from Effect schemas where overlap exists

## Alternatives Considered

### Alternative 1: TypeBox

- Generates JSON Schema for OpenAPI
- Works with Effect.ts
- **Rejected**: Less mature, smaller ecosystem, poor React Hook Form support

### Alternative 2: Yup

- Popular validation library
- Good React integration
- **Rejected**: Poor TypeScript inference, no Effect.ts integration, being phased out for Zod

### Alternative 3: Custom Validation

- Write our own validation layer
- **Rejected**: Massive maintenance burden, reinventing the wheel

## References

- [Effect Schema Documentation](https://effect.website/docs/guides/schema/introduction)
- [Zod Documentation](https://zod.dev)
- [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
- [React Hook Form Resolvers](https://github.com/react-hook-form/resolvers)

## Decision Date

2025-01-29

## Decision Makers

- Development Team
- Architecture Team

## Review Date

2025-07-01 (6 months)

---

**Note**: This decision should be reviewed after 6 months of production use to assess if the dual-library approach is working effectively or if consolidation is needed.
