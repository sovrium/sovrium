# Hono RPC Client + OpenAPI Documentation

> **Dual-Track API Pattern**: Runtime routes optimized for RPC type safety + parallel OpenAPI schema for documentation

## Overview

Sovrium uses a **dual-track API architecture** that provides both type-safe RPC client access and comprehensive OpenAPI documentation from a single set of Zod schemas.

### Critical Architectural Decision: Zod vs Effect Schema

**Sovrium uses two validation libraries with strict separation**:

| Library           | Version | Usage                            | Allowed Locations                                                | Enforced By       |
| ----------------- | ------- | -------------------------------- | ---------------------------------------------------------------- | ----------------- |
| **Effect Schema** | 3.19.5  | Server validation, domain models | All `src/` files                                                 | Project standard  |
| **Zod**           | 4.1.12  | OpenAPI integration ONLY         | `src/presentation/api/schemas/` + `src/presentation/api/routes/` | ESLint boundaries |

**Why This Separation Exists**:

1. **Effect Schema** is the project standard for all domain validation and business logic
2. **Zod** is required ONLY for OpenAPI tooling (`@hono/zod-openapi`) compatibility
3. OpenAPI tools do not support Effect Schema, forcing this dual-track approach
4. Without strict enforcement, developers might use Zod everywhere, breaking architectural consistency

**ESLint Enforcement** (eslint.config.ts lines 1086-1120):

```typescript
// Zod is FORBIDDEN in src/ except specific API directories
{
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['src/presentation/api/schemas/**/*.{ts,tsx}'], // Exception
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'zod',
            message: 'Zod is restricted in src/ - use Effect Schema for server validation. EXCEPTION: Zod is allowed in src/presentation/api/schemas for OpenAPI/Hono integration.'
          },
          {
            name: '@hono/zod-validator',
            message: 'Zod validator is restricted - use Effect Schema. EXCEPTION: Allowed in src/presentation/api/schemas for API routes.'
          }
        ]
      }
    ]
  }
}
```

**What This Means for Code Generation**:

- ✅ **Use Effect Schema**: All domain models, validators, and business logic
- ✅ **Use Zod**: ONLY for `src/presentation/api/schemas/*-schemas.ts` files (OpenAPI contracts)
- ❌ **Don't use Zod**: Anywhere else in `src/` (ESLint will error)
- ✅ **Use `@hono/zod-validator`**: ONLY in `src/presentation/api/routes/*.ts` for request validation

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ SHARED ZOD SCHEMAS (Domain Layer)                                │
│ src/presentation/api/schemas/*.ts                                       │
│ - healthResponseSchema                                           │
│ - tableSchema, recordSchema (future)                            │
└────────────────┬─────────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────────┐  ┌────────────────────┐
│ RUNTIME ROUTES   │  │ OPENAPI SCHEMA     │
│ (Presentation)   │  │ (Presentation)     │
├──────────────────┤  ├────────────────────┤
│ Regular Hono     │  │ OpenAPIHono        │
│ + zValidator     │  │ + createRoute()    │
│ Path: :id        │  │ Path: {id}         │
│ Effect.gen       │  │ Dummy handlers     │
└────────┬─────────┘  └─────────┬──────────┘
         │                      │
         ▼                      ▼
┌──────────────────┐  ┌────────────────────┐
│ HONO RPC CLIENT  │  │ API DOCUMENTATION  │
│ (Frontend)       │  │ (Runtime + Export) │
├──────────────────┤  ├────────────────────┤
│ hc<AppType>()    │  │ /api/openapi.json  │
│ Fully typed      │  │ /api/scalar        │
│ Autocomplete     │  │ schemas/0.0.1/     │
└──────────────────┘  └────────────────────┘
```

## Why Dual-Track?

### The Problem

**OpenAPIHono** and **Hono RPC** are incompatible:

- OpenAPIHono uses OpenAPI path syntax: `/users/{id}`
- Hono RPC expects Hono path syntax: `/users/:id`
- You cannot export `AppType` from OpenAPIHono routes for RPC usage

### The Solution

**Separate concerns, share schemas**:

1. **Runtime routes** use regular Hono + zValidator (RPC compatible)
2. **OpenAPI schema** uses OpenAPIHono + createRoute (docs compatible)
3. **Both share** the same Zod schemas from domain layer

**Benefits**:

- ✅ Type-safe RPC client with autocomplete
- ✅ Beautiful API documentation (Scalar UI)
- ✅ Single source of truth (Zod schemas)
- ✅ No code duplication (schemas reused)
- ✅ Roadmap tracking (compare design vs implementation)

## File Structure

```
src/
├── domain/
│   └── models/
│       └── api/
│           ├── health-schemas.ts       # Shared Zod schemas
│           └── table-schemas.ts        # Future: table schemas
│
├── presentation/
│   └── api/
│       ├── app.ts                      # Main API app (regular Hono)
│       ├── routes/
│       │   ├── health.ts               # Health endpoint (Effect.gen)
│       │   └── tables.ts               # Future: tables endpoint
│       ├── openapi-schema.ts           # Parallel OpenAPI generator
│       └── client.ts                   # RPC client factory
│
└── infrastructure/
    └── server/
        └── server.ts                    # Mounts API routes + Scalar

scripts/
└── export-openapi.ts                    # Export OpenAPI to schemas/

schemas/
└── 0.0.1/
    └── app.openapi.json                 # Generated OpenAPI schema
```

## Creating API Endpoints

### Step 1: Define Zod Schemas (Domain Layer)

**CRITICAL**: Zod schemas MUST be in `src/presentation/api/schemas/` directory. This is the ONLY location where Zod is allowed (enforced by ESLint).

Create shared schemas in `src/presentation/api/schemas/`:

```typescript
// src/presentation/api/schemas/user-schemas.ts
// NOTE: Zod import is ONLY allowed in src/presentation/api/schemas/ files
import { z } from 'zod'

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  createdAt: z.string().datetime(),
})

export const createUserRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export type UserResponse = z.infer<typeof userResponseSchema>
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>
```

### Step 2: Create Runtime Route (Regular Hono)

Create route in `src/presentation/api/routes/`:

```typescript
// src/presentation/api/routes/users.ts
import { Effect } from 'effect'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  userResponseSchema,
  createUserRequestSchema,
  type UserResponse,
} from '@/presentation/api/schemas/user-schemas'

export const createUsersRoute = () => {
  const route = new Hono()

  // GET /users/:id - Note: Hono syntax `:id`
  route.get('/:id', async (c) => {
    const id = c.req.param('id')

    const program = Effect.gen(function* () {
      // Your business logic here using Effect.gen
      // Example: yield* UserService.getById(id)

      const user: UserResponse = {
        id,
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date().toISOString(),
      }

      // Validate response
      const validated = yield* Effect.try({
        try: () => userResponseSchema.parse(user),
        catch: (error) => new Error(`Validation failed: ${error}`),
      })

      return validated
    })

    try {
      const data = await Effect.runPromise(program)
      return c.json(data, 200)
    } catch (error) {
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // POST /users
  route.post('/', zValidator('json', createUserRequestSchema), async (c) => {
    const body = c.req.valid('json')

    const program = Effect.gen(function* () {
      // Your business logic here
      const user: UserResponse = {
        id: crypto.randomUUID(),
        ...body,
        createdAt: new Date().toISOString(),
      }

      return user
    })

    try {
      const data = await Effect.runPromise(program)
      return c.json(data, 201)
    } catch (error) {
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  return route
}
```

### Step 3: Mount Route in API App

Update `src/presentation/api/app.ts`:

```typescript
import { Hono } from 'hono'
import { createHealthRoute } from './routes/health'
import { createUsersRoute } from './routes/users'
import type { App } from '@/domain/models/app'

export const createApiApp = (app: App) => {
  const apiApp = new Hono()

  apiApp.route('/health', createHealthRoute(app))
  apiApp.route('/users', createUsersRoute()) // Add new route

  return apiApp
}

export type ApiAppType = ReturnType<typeof createApiApp>
```

### Step 4: Add OpenAPI Schema Definition

Update `src/presentation/api/openapi-schema.ts`:

```typescript
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  userResponseSchema,
  createUserRequestSchema,
} from '@/presentation/api/schemas/user-schemas'

const createOpenApiApp = () => {
  const app = new OpenAPIHono()

  // Define GET /api/users/{id} - Note: OpenAPI syntax `{id}`
  const getUserRoute = createRoute({
    method: 'get',
    path: '/api/users/{id}',
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
            schema: userResponseSchema,
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
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString(),
    })
  })

  // Define POST /api/users
  const createUserRoute = createRoute({
    method: 'post',
    path: '/api/users',
    summary: 'Create new user',
    tags: ['users'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createUserRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: userResponseSchema,
          },
        },
        description: 'User created',
      },
    },
  })

  app.openapi(createUserRoute, (c) => {
    return c.json(
      {
        id: crypto.randomUUID(),
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date().toISOString(),
      },
      201
    )
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
    tags: [
      { name: 'infrastructure' },
      { name: 'users' }, // Add new tag
    ],
  })
}
```

## Using the RPC Client

### Frontend Setup

```typescript
// src/frontend/api.ts
import { createApiClient } from '@/presentation/api/client'

export const api = createApiClient('http://localhost:3000')
```

### Making Requests

```typescript
// Fully typed with autocomplete!
const res = await api.api.health.$get()
const data = await res.json()
// data: { status: 'ok', timestamp: string, app: { name: string } }

// With path parameters
const userRes = await api.api.users[':id'].$get({
  param: { id: '123' },
})
const user = await userRes.json()
// user: { id: string, name: string, email: string, createdAt: string }

// POST request
const createRes = await api.api.users.$post({
  json: {
    name: 'Jane Doe',
    email: 'jane@example.com',
  },
})
const newUser = await createRes.json()
```

### React + TanStack Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from './api'

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: async () => {
      const res = await api.api.users[':id'].$get({ param: { id: userId } })
      if (!res.ok) throw new Error('Failed to fetch user')
      return res.json()
    }
  })

  if (isLoading) return <div>Loading...</div>

  return <div>{data?.name}</div>
}

function CreateUser() {
  const mutation = useMutation({
    mutationFn: async (input: { name: string; email: string }) => {
      const res = await api.api.users.$post({ json: input })
      if (!res.ok) throw new Error('Failed to create user')
      return res.json()
    }
  })

  return (
    <button onClick={() => mutation.mutate({
      name: 'New User',
      email: 'new@example.com'
    })}>
      Create User
    </button>
  )
}
```

## API Documentation

### Scalar UI

Visit `http://localhost:3000/api/scalar` for beautiful interactive API documentation with:

- Endpoint explorer
- Request/response examples
- Schema definitions
- Try-it-out functionality

### OpenAPI JSON

Access raw OpenAPI schema at `http://localhost:3000/api/openapi.json` for:

- External tool integration
- Postman/Insomnia import
- Code generation (if needed)

### Export for Roadmap

```bash
bun run export:openapi
```

Exports to `schemas/0.0.1/app.openapi.json` for:

- Version tracking
- Roadmap generation (compare with docs specs)
- External consumption

## Effect.ts Integration

All API handlers follow Effect.gen patterns for:

### Dependency Injection

```typescript
// Define service interface
interface UserService {
  getById: (id: string) => Effect.Effect<User, UserNotFoundError>
}

// Use in handler
const program = Effect.gen(function* () {
  const userService = yield* UserService
  const user = yield* userService.getById(id)
  return user
})
```

### Error Handling

```typescript
// Define custom errors
class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  userId: string
}> {}

// Handle in route
const program = Effect.gen(function* () {
  const user = yield* userService.getById(id)
  return user
}).pipe(
  Effect.catchTag('UserNotFoundError', (error) =>
    Effect.succeed({ error: 'User not found', code: 'USER_NOT_FOUND' })
  )
)

try {
  const data = await Effect.runPromise(program)
  return c.json(data, 200)
} catch (error) {
  return c.json({ error: 'Internal server error' }, 500)
}
```

## Best Practices

### 1. Always Share Zod Schemas

❌ **Don't**: Define schemas separately for runtime and OpenAPI

```typescript
// runtime-route.ts
const schema1 = z.object({ name: z.string() })

// openapi-schema.ts
const schema2 = z.object({ name: z.string() }) // Duplication!
```

✅ **Do**: Define once in domain layer, import everywhere

```typescript
// presentation/api/schemas/schemas.ts
export const userSchema = z.object({ name: z.string() })

// Both files import the same schema
import { userSchema } from '@/presentation/api/schemas/schemas'
```

### 2. Use Effect.gen for All Handlers

Even simple handlers benefit from Effect patterns for consistency:

```typescript
route.get('/', async (c) => {
  const program = Effect.gen(function* () {
    // Business logic here
    return { message: 'Hello' }
  })

  try {
    const data = await Effect.runPromise(program)
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500)
  }
})
```

### 3. Validate Responses

Always validate responses against Zod schemas:

```typescript
const program = Effect.gen(function* () {
  const data = {
    /* ... */
  }

  // Ensure response matches schema
  const validated = yield* Effect.try({
    try: () => responseSchema.parse(data),
    catch: (error) => new Error(`Validation failed: ${error}`),
  })

  return validated
})
```

### 4. Keep Paths in Sync

**Runtime route** (Hono syntax):

```typescript
route.get('/users/:id', ...)
```

**OpenAPI schema** (OpenAPI syntax):

```typescript
createRoute({
  path: '/api/users/{id}',  // Note: /api prefix + {id}
  ...
})
```

## Troubleshooting

### Type errors with RPC client

**Problem**: Client shows type errors or "Property does not exist"

**Solution**: Ensure you're exporting `ApiAppType` from `app.ts`:

```typescript
export type ApiAppType = ReturnType<typeof createApiApp>
```

### OpenAPI schema missing endpoints

**Problem**: New endpoints don't appear in `/api/openapi.json`

**Solution**: Remember to add parallel OpenAPI route definition in `openapi-schema.ts`

### Path parameter mismatch

**Problem**: RPC client can't find route with path parameters

**Solution**:

- Runtime route: Use Hono syntax `/users/:id`
- OpenAPI schema: Use OpenAPI syntax `/api/users/{id}`

### ESLint error: "Zod is restricted in src/"

**Problem**: ESLint error when importing Zod outside allowed directories

**Error Message**:

```
Zod is restricted in src/ - use Effect Schema for server validation.
EXCEPTION: Zod is allowed in src/presentation/api/schemas for OpenAPI/Hono integration.
```

**Solution**:

1. **For API schemas**: Move Zod schema to `src/presentation/api/schemas/*-schemas.ts`
2. **For domain models**: Use Effect Schema instead of Zod
3. **For validation**: Use Effect Schema throughout application layer

**Example - Converting Zod to Effect Schema**:

```typescript
// ❌ DON'T: Zod in domain/models/
// src/domain/models/user.ts
import { z } from 'zod' // ESLint error!

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
})

// ✅ DO: Effect Schema in domain/models/
// src/domain/models/user.ts
import { Schema } from 'effect'

export const UserSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.NonEmptyString,
})
```

## When to Use Zod vs Effect Schema

**Quick Decision Guide**:

| Scenario                       | Use                   | Location                                    | Why                         |
| ------------------------------ | --------------------- | ------------------------------------------- | --------------------------- |
| Domain model validation        | Effect Schema         | `src/domain/models/*.ts`                    | Project standard            |
| Business logic validation      | Effect Schema         | `src/domain/validators/*.ts`                | Type safety + DI            |
| API request/response contracts | Zod                   | `src/presentation/api/schemas/*-schemas.ts` | OpenAPI tooling requirement |
| API route validation           | `@hono/zod-validator` | `src/presentation/api/routes/*.ts`          | OpenAPI integration         |
| Client-side forms              | Zod                   | React Hook Form integration                 | Client validation only      |
| Database models                | Drizzle Schema        | `src/infrastructure/database/schema.ts`     | ORM requirement             |

**Detailed Guidelines**:

### Use Effect Schema When:

- ✅ Defining domain models in `src/domain/models/`
- ✅ Creating validators in `src/domain/validators/`
- ✅ Validating business rules in `src/domain/services/`
- ✅ Parsing configuration in `src/infrastructure/config/`
- ✅ Validating database queries in `src/infrastructure/database/`
- ✅ ANY server-side validation not related to OpenAPI

**Example**:

```typescript
// src/domain/models/table.ts
import { Schema } from 'effect'

export const TableSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.NonEmptyString,
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  createdAt: Schema.Date,
})
```

### Use Zod When:

- ✅ Defining OpenAPI API contracts in `src/presentation/api/schemas/*-schemas.ts`
- ✅ Using `@hono/zod-validator` in `src/presentation/api/routes/*.ts`
- ✅ Client-side React Hook Form validation (presentation layer only)

**Example**:

```typescript
// src/presentation/api/schemas/table-schemas.ts
import { z } from 'zod'

export const tableResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  createdAt: z.string().datetime(),
})
```

### Bridging Zod and Effect Schema

When you need to convert between Zod (API layer) and Effect Schema (domain layer):

```typescript
// src/presentation/api/schemas/table-schemas.ts
import { z } from 'zod'
import { Schema } from 'effect'
import { TableSchema } from '@/domain/models/table'

// Zod schema for OpenAPI
export const tableResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  createdAt: z.string().datetime(), // ISO 8601 string for JSON
})

// Effect Schema for domain
// Note: TableSchema uses Schema.Date, not ISO string
// Conversion happens in API route handlers

// API route handler bridges the two
route.get('/:id', async (c) => {
  const program = Effect.gen(function* () {
    // 1. Fetch from domain layer (Effect Schema)
    const table = yield* TableService.getById(id) // Returns TableSchema

    // 2. Convert to API response (Zod-compatible)
    const response = {
      id: table.id,
      name: table.name,
      slug: table.slug,
      createdAt: table.createdAt.toISOString(), // Date → ISO string
    }

    // 3. Validate against Zod schema (ensures OpenAPI contract)
    const validated = yield* Effect.try({
      try: () => tableResponseSchema.parse(response),
      catch: (error) => new Error(`Validation failed: ${error}`),
    })

    return validated
  })

  const data = await Effect.runPromise(program)
  return c.json(data, 200)
})
```

## Related Documentation

- `@docs/infrastructure/framework/hono.md` - Hono web framework basics
- `@docs/infrastructure/framework/effect.md` - Effect.ts patterns
- `@docs/architecture/layer-based-architecture.md` - Layer separation
- `@docs/architecture/api-conventions.md` - API naming conventions
