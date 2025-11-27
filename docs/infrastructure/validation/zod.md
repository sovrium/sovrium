# Zod - TypeScript-First Schema Validation

## Overview

**Version**: ^4.1.12
**Purpose**: TypeScript-first schema validation with static type inference, specifically used for OpenAPI schema generation and client-side form validation in Sovrium

Zod is a TypeScript-first schema declaration and validation library. In Sovrium, it serves a specific purpose: handling OpenAPI schema generation for HTTP contracts and client-side form validation with React Hook Form.

## Why Zod in Sovrium (Limited Scope)

While Effect Schema is the primary validation library for domain models, Zod is used in two specific contexts:

1. **OpenAPI Integration** (`src/presentation/api/schemas/`):
   - Integrates with `@hono/zod-openapi` for automatic OpenAPI spec generation
   - Provides HTTP request/response schemas for API documentation
   - Enables type-safe RPC client generation

2. **Client-Side Forms** (React Hook Form):
   - Works seamlessly with React Hook Form's zodResolver
   - Provides runtime validation in the browser
   - Offers better DX for form-specific validations

## Zod vs Effect Schema Split

### When to Use Effect Schema

- **Domain models** (`src/domain/models/app/`)
- **Server-side validation** (application layer)
- **Business logic validation**
- **Complex data transformations**
- **Integration with Effect.ts ecosystem**

### When to Use Zod

- **OpenAPI schemas** (`src/presentation/api/schemas/`)
- **HTTP request/response contracts**
- **Client form validation** (with React Hook Form)
- **API documentation generation**

## Core Concepts

### 1. Schema Definition

```typescript
// src/presentation/api/schemas/health-schemas.ts
import { z } from 'zod'

// Define schema for API response
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  version: z.string(),
  services: z.record(
    z.string(),
    z.object({
      status: z.enum(['up', 'down']),
      latency: z.number().optional(),
    })
  ),
})

// Infer TypeScript type from schema
export type HealthResponse = z.infer<typeof HealthResponseSchema>
```

### 2. OpenAPI Integration

```typescript
// src/presentation/api/routes/health.ts
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HealthResponseSchema } from '@/presentation/api/schemas/health-schemas'

const route = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      description: 'Health check response',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
})

const app = new OpenAPIHono()

app.openapi(route, async (c) => {
  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    services: {
      database: { status: 'up', latency: 23 },
      cache: { status: 'up', latency: 5 },
    },
  }

  return c.json(response)
})
```

### 3. Form Validation

```typescript
// src/presentation/components/forms/UserForm.tsx
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// Define form schema
const userFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  age: z.number().min(18, 'Must be at least 18 years old'),
  role: z.enum(['admin', 'user', 'guest']),
})

type UserFormData = z.infer<typeof userFormSchema>

export function UserForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
  })

  const onSubmit = (data: UserFormData) => {
    // Data is guaranteed to match schema
    console.log('Valid data:', data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}

      <button type="submit">Submit</button>
    </form>
  )
}
```

## Common Patterns

### Request/Response Schemas

```typescript
// src/presentation/api/schemas/user-schemas.ts
import { z } from 'zod'

// Request body schema
export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

// Response schema
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
})

// Error response
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.any()).optional(),
  }),
})
```

### Shared Schemas

```typescript
// src/presentation/api/schemas/common-schemas.ts
import { z } from 'zod'

// Pagination params (reusable)
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// Common ID validation
export const UUIDSchema = z.string().uuid()
export const IntegerIDSchema = z.coerce.number().int().positive()

// Standard timestamps
export const TimestampsSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
```

## Integration with Hono RPC

```typescript
// src/presentation/api/client.ts
import { hc } from 'hono/client'
import type { AppType } from '@/presentation/api/app'

// Type-safe client generation
const client = hc<AppType>('http://localhost:3000')

// Fully typed API calls
const response = await client.api.users.$post({
  json: {
    email: 'user@example.com',
    password: 'securePassword123',
  },
})

if (response.ok) {
  const user = await response.json() // Typed as UserResponse
}
```

## Best Practices

### DO's ✅

1. **Use for API contracts**: Define all HTTP request/response schemas with Zod
2. **Keep schemas in api/ directory**: Maintain clear separation from domain models
3. **Export inferred types**: Always export TypeScript types from schemas
4. **Use coercion for query params**: `z.coerce.number()` for URL parameters
5. **Validate at boundaries**: Use Zod at HTTP boundaries, not in domain logic

### DON'Ts ❌

1. **Don't use in domain layer**: Domain models should use Effect Schema
2. **Don't duplicate validation**: Choose either Zod or Effect Schema, not both
3. **Don't use for complex business rules**: Keep Zod for simple, flat validations
4. **Don't import from app/ models**: API schemas should be independent

## Common Pitfalls

### 1. Wrong Directory Location

```typescript
// ❌ WRONG: Zod in domain/models/app/
// src/domain/models/app/user.ts
import { z } from 'zod'
const UserSchema = z.object({...}) // Should use Effect Schema here

// ✅ CORRECT: Zod in presentation/api/schemas/
// src/presentation/api/schemas/user-schemas.ts
import { z } from 'zod'
const UserResponseSchema = z.object({...}) // Correct for API contracts
```

### 2. Mixing Validation Libraries

```typescript
// ❌ WRONG: Using both in same context
import { Schema } from 'effect'
import { z } from 'zod'

const UserEffectSchema = Schema.Struct({...})
const UserZodSchema = z.object({...}) // Duplicate validation

// ✅ CORRECT: Clear separation
// domain/models/app/user.ts - Effect Schema for domain
// presentation/api/schemas/user-schemas.ts - Zod for API
```

### 3. ESLint Restrictions

ESLint enforces Zod usage restrictions:

```typescript
// ❌ BLOCKED by ESLint in these locations:
// - src/domain/models/app/**/* (Effect Schema only)
// - src/application/**/* (Effect Schema only)
// - src/infrastructure/**/* (Effect Schema only)

// ✅ ALLOWED in:
// - src/presentation/api/schemas/**/* (API contracts)
// - src/presentation/**/* (forms, API routes)
```

## References

- [Zod Official Documentation](https://zod.dev)
- [@hono/zod-openapi Documentation](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
- [React Hook Form Zod Resolver](https://react-hook-form.com/docs/useform#resolver)
- [Effect Schema Documentation](./effect.md) - For domain validation

---

**Remember**: In Sovrium, Zod is a specialized tool for OpenAPI and forms. For all other validation needs, use Effect Schema.
