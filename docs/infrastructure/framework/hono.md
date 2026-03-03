# Hono - Ultrafast Web Framework

## Overview

**Version**: ^4.12.3
**Purpose**: Ultrafast, lightweight web framework for building APIs and web applications on Bun
**Full Reference**: https://hono.dev/llms.txt

## Why Hono for Sovrium

- **Ultra-Lightweight**: Under 14kB, no dependencies
- **Blazing Fast**: Optimized routing engine
- **Web Standard APIs**: Built on standard Request/Response
- **Bun-Ready**: Runs natively on Bun without adapters
- **TypeScript First**: Excellent type inference for routes, params, and context
- **Effect Compatible**: Works seamlessly with Effect.ts for business logic
- **Server-Side Rendering**: Renders React components server-side

## Sovrium-Specific Patterns

### Entry Point

```typescript
// src/index.ts
import { Hono } from 'hono'

const app = new Hono()

// Routes are mounted via setupAuthRoutes, setupStaticRoutes, etc.
export default app
```

### Integration with Effect

Hono routes consume Effect programs from the Application layer:

```typescript
app.get('/users/:id', async (c) => {
  const id = Number(c.req.param('id'))

  const program = Effect.gen(function* () {
    const user = yield* fetchUser(id)
    const posts = yield* fetchUserPosts(user.id)
    return { user, posts }
  }).pipe(Effect.provide(AppLayer))

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to fetch user' }, 500)
  }

  return c.json(result.right)
})
```

### Server-Side Rendering with React

```typescript
import { renderToString } from 'react-dom/server'

app.get('/', (c) => {
  const html = renderToString(<HomePage />)
  return c.html(html)
})
```

### Auth Routes Setup

Better Auth is mounted at `/api/auth/*` via `setupAuthRoutes()`:

```typescript
// src/infrastructure/server/route-setup/auth-routes.ts
export function setupAuthRoutes(honoApp, app?) {
  if (!app?.auth) return honoApp // No auth = 404 for /api/auth/*

  const authInstance = createAuthInstance(app.auth)

  // CORS, auth check, rate limiting middleware applied first
  return app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
```

### Middleware Stack

Sovrium applies middleware in this order:

1. **CORS** — for `/api/auth/*` routes
2. **Auth check** — for `/api/auth/admin/*` (returns 401 before parameter validation)
3. **Rate limiting** — for admin and auth endpoints
4. **Better Auth handler** — processes the request

### Static Assets

CSS is served dynamically via Hono route (compiled from domain theme models):

```typescript
app.get('/assets/output.css', async (c) => {
  const compiled = yield * compileCSS(app)
  return c.text(compiled.css, 200, {
    'Content-Type': 'text/css',
    'Cache-Control': 'public, max-age=31536000',
  })
})
```

### API Validation with Zod

Request validation uses `@hono/zod-validator` in API routes:

```typescript
import { zValidator } from '@hono/zod-validator'
import { createUserRequestSchema } from '@/domain/models/api/user'

route.post('/', zValidator('json', createUserRequestSchema), async (c) => {
  const body = c.req.valid('json') // Type-safe validated body
  // ...
})
```

### Error Handling

```typescript
// Global error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})
```

### Testing Hono Routes

```typescript
import { test, expect } from 'bun:test'
import app from './index'

test('GET / returns hello message', async () => {
  const req = new Request('http://localhost/')
  const res = await app.fetch(req)
  expect(res.status).toBe(200)
})
```

## Key Differences from Generic Hono

- **Effect for business logic**: Hono handlers are thin wrappers, Effect.gen for workflows
- **Dynamic CSS**: CSS compiled per-theme at runtime, not static files
- **Auth via Better Auth**: Not custom middleware — Better Auth handles all `/api/auth/*`
- **Zod for API validation**: Effect Schema for domain, Zod only in presentation layer
- **SSR with React**: Server-side rendered React components via `renderToString`

## Full Documentation

- Official: https://hono.dev/
- LLM-optimized: https://hono.dev/llms.txt
- GitHub: https://github.com/honojs/hono
