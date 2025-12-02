# Zod + Hono + OpenAPI Integration v4.1.13

## Overview

**Purpose**: Schema validation library for OpenAPI API contracts and client-side forms
**Scope**: Limited to `src/presentation/api/schemas/` and `src/presentation/` (client forms)
**Enforced By**: ESLint boundaries (lines 1086-1120 in eslint.config.ts)

## Critical Architectural Decision: Zod vs Effect Schema

**Sovrium uses two validation libraries with strict separation**:

| Library           | Version | Usage                     | Allowed Locations                            | Why                                |
| ----------------- | ------- | ------------------------- | -------------------------------------------- | ---------------------------------- |
| **Effect Schema** | 3.19.8  | Server validation, domain | All `src/` files (default)                   | Project standard, Effect ecosystem |
| **Zod**           | 4.1.13  | OpenAPI + client forms    | `src/presentation/api/schemas/` + forms only | OpenAPI tooling compatibility      |

**Why This Separation Exists**:

1. **Effect Schema** is the project standard for all domain validation and business logic
2. **Zod** is required ONLY for:
   - OpenAPI tooling (`@hono/zod-openapi`) compatibility (no Effect Schema support)
   - React Hook Form integration (lightweight client-side validation)
3. Without strict enforcement, developers might use Zod everywhere, breaking architectural consistency

## Installation

```bash
# Already in package.json
bun add zod                    # 4.1.13 - Schema validation
bun add @hono/zod-openapi      # 1.1.4 - OpenAPI schema generation
bun add @hono/zod-validator    # 0.7.4 - Hono request validation
bun add @hookform/resolvers    # 5.2.2 - React Hook Form + Zod integration
```

## ESLint Enforcement

### Restriction Rule (eslint.config.ts lines 1096-1126)

```typescript
// Zod is FORBIDDEN in src/ except API models and presentation layer
{
  files: ['src/**/*.{ts,tsx}'],
  ignores: [
    'src/presentation/api/schemas/**/*.{ts,tsx}', // Exception for API models
    'src/presentation/**/*.{ts,tsx}', // Exception for presentation layer
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'zod',
            message: 'Zod is restricted in src/ - use Effect Schema for server validation. EXCEPTIONS: Zod is allowed in src/presentation/api/schemas for OpenAPI/Hono integration AND src/presentation for client forms.'
          },
          {
            name: '@hono/zod-validator',
            message: 'Zod validator is restricted - use Effect Schema. EXCEPTION: Allowed in src/presentation/api/schemas and src/presentation/api/routes for API validation.'
          }
        ]
      }
    ]
  }
}
```

### Exception Rules (eslint.config.ts lines 1128-1147)

```typescript
// API models in src/presentation/api/schemas can use Zod for OpenAPI/Hono integration
{
  files: ['src/presentation/api/schemas/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': 'off', // Allow Zod and @hono/zod-validator
  }
}

// Presentation layer can use Zod for client forms and API routes
{
  files: ['src/presentation/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': 'off', // Allow Zod, @hono/zod-validator, @hookform/resolvers
  }
}
```

## Where to Use Zod

### ✅ Allowed Locations

| Location                                    | Purpose                        | Imports Allowed                     |
| ------------------------------------------- | ------------------------------ | ----------------------------------- |
| `src/presentation/api/schemas/*-schemas.ts` | OpenAPI API contracts          | `zod`, `@hono/zod-openapi`          |
| `src/presentation/api/routes/*.ts`          | API route request validation   | `@hono/zod-validator`               |
| `src/presentation/components/**/*.tsx`      | Client-side form validation    | `zod`, `@hookform/resolvers`        |
| `src/presentation/hooks/*.ts`               | Form hooks with Zod validation | `zod`, `react-hook-form`, resolvers |

### ❌ Forbidden Locations

| Location                       | Use Instead   | Why                                            |
| ------------------------------ | ------------- | ---------------------------------------------- |
| `src/domain/models/*.ts`       | Effect Schema | Domain models must use project standard        |
| `src/domain/validators/*.ts`   | Effect Schema | Business validation uses Effect                |
| `src/domain/services/*.ts`     | Effect Schema | Domain services pure with Effect               |
| `src/application/use-cases/`   | Effect Schema | Use cases orchestrate with Effect              |
| `src/infrastructure/config/`   | Effect Schema | Configuration parsing uses Effect              |
| `src/infrastructure/database/` | Drizzle + Bun | Database uses Drizzle schema + bun:sql queries |

## Usage Patterns

### 1. Server API Models (OpenAPI Integration)

**File**: `src/presentation/api/schemas/*-schemas.ts`

```typescript
// src/presentation/api/schemas/user-schemas.ts
import { z } from 'zod'

/**
 * User API response schema
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API response validation
 * - Hono RPC client type inference
 */
export const userResponseSchema = z.object({
  id: z.string().uuid().describe('Unique user identifier'),
  email: z.string().email().describe('User email address'),
  name: z.string().min(1).max(100).describe('User display name'),
  role: z.enum(['admin', 'user', 'guest']).describe('User role'),
  createdAt: z.string().datetime().describe('ISO 8601 creation timestamp'),
})

/**
 * Create user request schema
 */
export const createUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
})

/**
 * Update user request schema
 */
export const updateUserRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
})

// TypeScript types inferred from schemas
export type UserResponse = z.infer<typeof userResponseSchema>
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>
```

**Key Conventions**:

- File naming: `*-schemas.ts` (plural, kebab-case)
- Schema naming: `{entity}{Action}Schema` (camelCase with "Schema" suffix)
- Type naming: Match schema name without "Schema" suffix (PascalCase)
- Descriptions: Use `.describe()` for OpenAPI documentation
- ISO 8601: Use `z.string().datetime()` for timestamps (not `z.date()`)

### 2. API Route Validation (Hono + zValidator)

**File**: `src/presentation/api/routes/*.ts`

```typescript
// src/presentation/api/routes/users.ts
import { Effect } from 'effect'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  userResponseSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  type UserResponse,
} from '@/presentation/api/schemas/user-schemas'

export const createUsersRoute = () => {
  const route = new Hono()

  // POST /users - Validate request body
  route.post('/', zValidator('json', createUserRequestSchema), async (c) => {
    const body = c.req.valid('json') // Type-safe validated body

    const program = Effect.gen(function* () {
      // Business logic here
      const user: UserResponse = {
        id: crypto.randomUUID(),
        email: body.email,
        name: body.name,
        role: 'user',
        createdAt: new Date().toISOString(),
      }

      // Validate response matches schema
      const validated = yield* Effect.try({
        try: () => userResponseSchema.parse(user),
        catch: (error) => new Error(`Response validation failed: ${error}`),
      })

      return validated
    })

    try {
      const data = await Effect.runPromise(program)
      return c.json(data, 201)
    } catch (error) {
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // PATCH /users/:id - Validate path param + body
  route.patch('/:id', zValidator('json', updateUserRequestSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')

    // Implementation...
  })

  return route
}
```

**zValidator Locations**:

| Target   | Usage                                          | Example                                       |
| -------- | ---------------------------------------------- | --------------------------------------------- |
| `json`   | Validate request body                          | `zValidator('json', createUserRequestSchema)` |
| `query`  | Validate query parameters                      | `zValidator('query', searchQuerySchema)`      |
| `param`  | Validate path parameters                       | `zValidator('param', idParamSchema)`          |
| `header` | Validate headers                               | `zValidator('header', authHeaderSchema)`      |
| `form`   | Validate form data (multipart/form-urlencoded) | `zValidator('form', uploadFormSchema)`        |
| `cookie` | Validate cookies                               | `zValidator('cookie', sessionCookieSchema)`   |

### 3. Client-Side Form Validation (React Hook Form)

See `@docs/infrastructure/ui/react-hook-form.md` for complete React Hook Form + Zod integration.

**Quick Example**:

```typescript
// src/presentation/components/CreateUserForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof formSchema>

export function CreateUserForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
    },
  })

  const onSubmit = async (data: FormValues) => {
    // Client-side validation passed
    // Now call API (which validates again with Effect Schema)
    await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

## OpenAPI Schema Generation

### Command

```bash
bun run export:openapi
```

Exports OpenAPI schema to `schemas/{version}/app.openapi.json` for:

- Version tracking and roadmap comparison
- External tool integration (Postman, Insomnia)
- API documentation generation

### OpenAPI Schema Definition

**File**: `src/presentation/api/openapi-schema.ts`

```typescript
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import {
  userResponseSchema,
  createUserRequestSchema,
} from '@/presentation/api/schemas/user-schemas'

const createOpenApiApp = () => {
  const app = new OpenAPIHono()

  // Define GET /api/users/{id}
  const getUserRoute = createRoute({
    method: 'get',
    path: '/api/users/{id}', // OpenAPI syntax: {id}
    summary: 'Get user by ID',
    tags: ['users'],
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: userResponseSchema, // Reuse shared schema
          },
        },
        description: 'User data',
      },
      404: {
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
        description: 'User not found',
      },
    },
  })

  // Dummy handler (only for schema generation)
  app.openapi(getUserRoute, (c) => {
    return c.json({
      id: c.req.param('id'),
      email: 'john@example.com',
      name: 'John Doe',
      role: 'user',
      createdAt: new Date().toISOString(),
    })
  })

  return app
}

export const getOpenAPIDocument = () => {
  const app = createOpenApiApp()
  return app.getOpenAPIDocument({
    openapi: '3.1.0',
    info: {
      title: 'Sovrium API',
      version: '0.0.1',
    },
    servers: [{ url: 'http://localhost:3000' }],
    tags: [{ name: 'users' }],
  })
}
```

## Zod Schema Patterns

### Basic Types

```typescript
import { z } from 'zod'

// Primitives
z.string()
z.number()
z.boolean()
z.date() // Avoid in API schemas, use z.string().datetime() for JSON
z.bigint()
z.undefined()
z.null()
z.void()
z.any() // Avoid
z.unknown()
z.never()

// Literals
z.literal('admin')
z.literal(42)
z.literal(true)

// Strings
z.string().min(1) // Non-empty
z.string().max(100)
z.string().email()
z.string().url()
z.string().uuid()
z.string().regex(/^[a-z0-9-]+$/)
z.string().datetime() // ISO 8601 (use for API timestamps)

// Numbers
z.number().int()
z.number().positive()
z.number().min(0)
z.number().max(100)

// Arrays
z.array(z.string())
z.string().array() // Alternative syntax
z.array(z.object({ id: z.string() })).min(1) // At least one element

// Objects
z.object({
  id: z.string().uuid(),
  name: z.string(),
})

// Unions
z.union([z.string(), z.number()])
z.string().or(z.number()) // Alternative

// Enums
z.enum(['admin', 'user', 'guest'])

// Optional/Nullable
z.string().optional() // string | undefined
z.string().nullable() // string | null
z.string().nullish() // string | null | undefined

// Default values
z.string().default('default value')
z.number().default(0)
```

### Advanced Patterns

```typescript
// Nested objects
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string().regex(/^\d{5}$/),
})

const userSchema = z.object({
  name: z.string(),
  address: addressSchema,
})

// Recursive schemas
type Category = {
  name: string
  subcategories: Category[]
}

const categorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    subcategories: z.array(categorySchema),
  })
)

// Discriminated unions
const shapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), radius: z.number() }),
  z.object({ kind: z.literal('rectangle'), width: z.number(), height: z.number() }),
])

// Record (key-value pairs)
z.record(z.string()) // { [key: string]: string }
z.record(z.string(), z.number()) // { [key: string]: number }

// Tuple
z.tuple([z.string(), z.number()]) // [string, number]

// Transform
z.string().transform((val) => val.toUpperCase())
z.string().transform((val) => parseInt(val))

// Refine (custom validation)
z.string().refine((val) => val.length > 5, {
  message: 'String must be longer than 5 characters',
})

// Superrefine (multiple errors)
z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).superrefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords must match',
      path: ['confirmPassword'],
    })
  }
})
```

## Bridging Zod and Effect Schema

When converting between Zod (API layer) and Effect Schema (domain layer):

```typescript
// src/domain/models/table.ts (Effect Schema)
import { Schema } from 'effect'

export const TableSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.NonEmptyString,
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  createdAt: Schema.Date, // Date object
})

export type Table = typeof TableSchema.Type

// src/presentation/api/schemas/table-schemas.ts (Zod)
import { z } from 'zod'

export const tableResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  createdAt: z.string().datetime(), // ISO 8601 string
})

export type TableResponse = z.infer<typeof tableResponseSchema>

// src/presentation/api/routes/tables.ts (Bridge)
import { Effect } from 'effect'
import { Hono } from 'hono'
import { TableSchema, type Table } from '@/domain/models/table'
import { tableResponseSchema, type TableResponse } from '@/presentation/api/schemas/table-schemas'

export const createTablesRoute = () => {
  const route = new Hono()

  route.get('/:id', async (c) => {
    const program = Effect.gen(function* () {
      // 1. Fetch from domain layer (Effect Schema, Date objects)
      const table: Table = yield* TableService.getById(id)

      // 2. Convert to API response (Zod-compatible, ISO strings)
      const response: TableResponse = {
        id: table.id,
        name: table.name,
        slug: table.slug,
        createdAt: table.createdAt.toISOString(), // Date → ISO string
      }

      // 3. Validate against Zod schema (ensures OpenAPI contract)
      const validated = yield* Effect.try({
        try: () => tableResponseSchema.parse(response),
        catch: (error) => new Error(`Response validation failed: ${error}`),
      })

      return validated
    })

    const data = await Effect.runPromise(program)
    return c.json(data, 200)
  })

  return route
}
```

## When to Use Zod vs Effect Schema

**Quick Decision Guide**:

| Scenario                       | Use                   | Location                            | Why                         |
| ------------------------------ | --------------------- | ----------------------------------- | --------------------------- |
| Domain model validation        | Effect Schema         | `src/domain/models/*.ts`            | Project standard            |
| Business logic validation      | Effect Schema         | `src/domain/validators/*.ts`        | Type safety + DI            |
| API request/response contracts | Zod                   | `src/presentation/api/schemas/*.ts` | OpenAPI tooling requirement |
| API route validation           | `@hono/zod-validator` | `src/presentation/api/routes/*.ts`  | OpenAPI integration         |
| Client-side forms              | Zod                   | `src/presentation/components/*.tsx` | React Hook Form integration |
| Database models                | Drizzle Schema        | `src/infrastructure/database/*.ts`  | ORM requirement             |
| Configuration                  | Effect Schema         | `src/infrastructure/config/*.ts`    | Effect ecosystem            |

## Best Practices

### 1. Single Source of Truth

✅ **Do**: Define Zod schemas once in `src/presentation/api/schemas/`, import everywhere

```typescript
// src/presentation/api/schemas/user-schemas.ts
export const userSchema = z.object({ name: z.string() })

// src/presentation/api/routes/users.ts
import { userSchema } from '@/presentation/api/schemas/user-schemas'
route.post('/', zValidator('json', userSchema), ...)

// src/presentation/api/openapi-schema.ts
import { userSchema } from '@/presentation/api/schemas/user-schemas'
const createUserRoute = createRoute({
  request: { body: { content: { 'application/json': { schema: userSchema } } } }
})
```

❌ **Don't**: Duplicate schemas across files

```typescript
// runtime-route.ts
const schema1 = z.object({ name: z.string() })

// openapi-schema.ts
const schema2 = z.object({ name: z.string() }) // Duplication!
```

### 2. Use Descriptions for OpenAPI Docs

```typescript
export const userSchema = z.object({
  email: z.string().email().describe('User email address'),
  name: z.string().min(1).describe('User display name'),
  role: z.enum(['admin', 'user']).describe('User role'),
})
```

### 3. Validate API Responses

Always validate responses against Zod schemas to ensure OpenAPI contract compliance:

```typescript
const program = Effect.gen(function* () {
  const data = {
    /* ... */
  }

  // Validate response
  const validated = yield* Effect.try({
    try: () => responseSchema.parse(data),
    catch: (error) => new Error(`Response validation failed: ${error}`),
  })

  return validated
})
```

### 4. ISO 8601 for Timestamps

Use `z.string().datetime()` for JSON API timestamps (not `z.date()`):

```typescript
// ✅ Good: ISO 8601 string for JSON
const userSchema = z.object({
  createdAt: z.string().datetime(), // "2025-01-15T10:30:00Z"
})

// ❌ Bad: Date object doesn't serialize to JSON
const userSchema = z.object({
  createdAt: z.date(), // Won't work in JSON
})
```

### 5. Type Inference

Always infer TypeScript types from Zod schemas:

```typescript
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

// ✅ Good: Type inferred from schema
export type User = z.infer<typeof userSchema>

// ❌ Bad: Manual type duplication
export type User = {
  id: string
  name: string
}
```

## Common Mistakes

### ❌ Using Zod Outside Allowed Locations

**Problem**: ESLint error when importing Zod in domain models

```typescript
// src/domain/models/user.ts
import { z } from 'zod' // ESLint error!
```

**Solution**: Use Effect Schema for domain models

```typescript
// src/domain/models/user.ts
import { Schema } from 'effect'

export const UserSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.NonEmptyString,
})
```

### ❌ Duplicating Schemas

**Problem**: Zod schema in API contracts duplicates Effect Schema in domain

**Solution**: Keep them separate (they serve different purposes):

- Effect Schema: Domain validation (Date objects, complex business rules)
- Zod: API contracts (ISO strings, OpenAPI compatibility)
- Bridge in API routes

### ❌ Using z.date() in API Schemas

**Problem**: Date objects don't serialize to JSON

```typescript
// ❌ Bad
const userSchema = z.object({
  createdAt: z.date(),
})
```

**Solution**: Use ISO 8601 strings

```typescript
// ✅ Good
const userSchema = z.object({
  createdAt: z.string().datetime(),
})
```

## Troubleshooting

### ESLint Error: "Zod is restricted in src/"

**Error**:

```
Zod is restricted in src/ - use Effect Schema for server validation.
EXCEPTION: Zod is allowed in src/presentation/api/schemas for OpenAPI/Hono integration.
```

**Solutions**:

1. **For API schemas**: Move to `src/presentation/api/schemas/*-schemas.ts`
2. **For domain models**: Use Effect Schema instead
3. **For validation**: Use Effect Schema in application layer

### Type Errors with Zod Schemas

**Problem**: TypeScript errors when using Zod schemas

**Solution**: Always use `z.infer<typeof schema>` for type inference

```typescript
const userSchema = z.object({ name: z.string() })
type User = z.infer<typeof userSchema> // ✅ Type-safe
```

### OpenAPI Schema Missing Descriptions

**Problem**: OpenAPI docs lack field descriptions

**Solution**: Add `.describe()` to all schema fields

```typescript
z.string().describe('User email address')
z.number().describe('User age in years')
```

## Related Documentation

- `@docs/infrastructure/api/hono-rpc-openapi.md` - Complete dual-track API architecture
- `@docs/infrastructure/ui/react-hook-form.md` - React Hook Form + Zod for client forms
- `@docs/infrastructure/framework/effect.md` - Effect Schema (server validation)
- `@docs/infrastructure/framework/hono.md` - Hono web framework
- `@docs/architecture/layer-based-architecture.md` - Layer separation rules

## References

- Zod documentation: https://zod.dev/
- @hono/zod-openapi: https://github.com/honojs/middleware/tree/main/packages/zod-openapi
- @hono/zod-validator: https://github.com/honojs/middleware/tree/main/packages/zod-validator
- OpenAPI 3.1 Specification: https://spec.openapis.org/oas/v3.1.0
