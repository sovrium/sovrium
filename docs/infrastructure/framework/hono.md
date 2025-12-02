# Hono - Ultrafast Web Framework

## Overview

**Version**: ^4.10.7 (minimum 4.10.7, allows patch/minor updates)
**Purpose**: Ultrafast, lightweight, and flexible web framework for building APIs and web applications on Bun, Cloudflare Workers, Deno, AWS Lambda, and Node.js

Hono is a modern web framework built on Web Standard APIs. It's designed to be blazing fast, under 14kB, and works seamlessly across multiple JavaScript runtimes without runtime-specific code.

## Why Hono for Sovrium

- **Ultra-Lightweight**: Under 14kB, no dependencies
- **Blazing Fast**: Optimized routing engine, one of the fastest frameworks
- **Web Standard APIs**: Built on standard Request/Response, works everywhere
- **TypeScript First**: Excellent type inference for routes, params, and context
- **Bun-Ready**: Runs natively on Bun without any adapters
- **Effect Compatible**: Works seamlessly with Effect.ts for business logic
- **Middleware Ecosystem**: Rich collection of built-in and third-party middleware
- **Server-Side Rendering**: Perfect for rendering React components
- **Zero Config**: Works out of the box with sensible defaults

## Basic Setup

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app
```

**Run with Bun**:

```bash
bun run src/index.ts
```

## Core Concepts

### 1. Context (c)

The Context object (`c`) contains all request information and utility methods:

```typescript
app.get('/users/:id', (c) => {
  // Route parameters
  const id = c.req.param('id')

  // Query parameters
  const page = c.req.query('page')

  // Headers
  const auth = c.req.header('Authorization')

  // Request body (JSON)
  const body = await c.req.json()

  // Response methods
  return c.json({ id, page }) // JSON response
  return c.text('Hello') // Text response
  return c.html('<h1>Hello</h1>') // HTML response
  return c.redirect('/new-url') // Redirect
})
```

### 2. Routing

Hono provides intuitive, type-safe routing:

```typescript
import { Hono } from 'hono'

const app = new Hono()

// Basic routes
app.get('/', (c) => c.text('GET /'))
app.post('/users', (c) => c.text('POST /users'))
app.put('/users/:id', (c) => c.text('PUT /users/:id'))
app.delete('/users/:id', (c) => c.text('DELETE /users/:id'))

// Route parameters
app.get('/users/:id', (c) => {
  const id = c.req.param('id')
  return c.json({ id })
})

// Multiple parameters
app.get('/posts/:postId/comments/:commentId', (c) => {
  const postId = c.req.param('postId')
  const commentId = c.req.param('commentId')
  return c.json({ postId, commentId })
})

// Optional parameters
app.get('/users/:id?', (c) => {
  const id = c.req.param('id') // May be undefined
  return c.json({ id })
})

// Wildcard routes
app.get('/files/*', (c) => {
  const path = c.req.path
  return c.text(`File path: ${path}`)
})

// Route groups
const api = app.basePath('/api')
api.get('/users', (c) => c.json([])) // GET /api/users
api.get('/posts', (c) => c.json([])) // GET /api/posts

export default app
```

### 3. Request Handling

Access request data with type safety:

```typescript
app.post('/users', async (c) => {
  // JSON body
  const body = await c.req.json()
  console.log(body.name, body.email)

  // Form data
  const formData = await c.req.formData()
  const name = formData.get('name')

  // Query parameters
  const page = c.req.query('page') // Single value
  const tags = c.req.queries('tag') // Multiple values (array)

  // Headers
  const contentType = c.req.header('Content-Type')
  const allHeaders = c.req.header() // All headers

  // URL
  const url = c.req.url
  const path = c.req.path
  const method = c.req.method

  return c.json({ success: true })
})
```

### 4. Response Methods

Hono provides convenient response helpers:

```typescript
app.get('/examples', (c) => {
  // JSON response
  return c.json({ message: 'Hello' }, 200)

  // Text response
  return c.text('Plain text')

  // HTML response
  return c.html('<h1>Hello</h1>')

  // Redirect
  return c.redirect('/new-url')
  return c.redirect('/new-url', 301) // Permanent redirect

  // Custom response
  return c.body('Custom body', 200, {
    'Content-Type': 'text/plain',
  })

  // Stream response
  return c.stream((stream) => {
    stream.write('chunk 1')
    stream.write('chunk 2')
    stream.close()
  })

  // Not found
  return c.notFound()
})
```

### 5. Middleware

Middleware runs before route handlers:

```typescript
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'

const app = new Hono()

// Global middleware (runs for all routes)
app.use('*', logger())
app.use('*', cors())

// Path-specific middleware
app.use('/api/*', async (c, next) => {
  console.log('API request')
  await next()
})

// Middleware with authentication
app.use('/admin/*', async (c, next) => {
  const token = c.req.header('Authorization')
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

// Custom middleware
const timer = async (c, next) => {
  const start = Date.now()
  await next()
  const end = Date.now()
  c.res.headers.set('X-Response-Time', `${end - start}ms`)
}

app.use('*', timer)

// Routes
app.get('/', (c) => c.text('Hello'))

export default app
```

### 6. Error Handling

Handle errors gracefully:

```typescript
import { Hono } from 'hono'

const app = new Hono()

// Route with error handling
app.get('/users/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const user = await fetchUser(id)
    return c.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return c.json({ error: 'User not found' }, 404)
  }
})

// Global error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  )
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

export default app
```

## Built-in Middleware

Hono includes useful middleware out of the box:

### Logger

```typescript
import { logger } from 'hono/logger'

app.use('*', logger())
// Logs: GET /api/users 200 45ms
```

### CORS

```typescript
import { cors } from 'hono/cors'

app.use(
  '/api/*',
  cors({
    origin: 'https://example.com',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
)
```

### Bearer Auth

```typescript
import { bearerAuth } from 'hono/bearer-auth'

app.use(
  '/api/*',
  bearerAuth({
    token: 'secret-token',
  })
)
```

### Cache

```typescript
import { cache } from 'hono/cache'

app.use(
  '*',
  cache({
    cacheName: 'my-app',
    cacheControl: 'max-age=3600',
  })
)
```

### Compress

```typescript
import { compress } from 'hono/compress'

app.use('*', compress())
```

### ETag

```typescript
import { etag } from 'hono/etag'

app.use('*', etag())
```

### Pretty JSON

```typescript
import { prettyJSON } from 'hono/pretty-json'

app.use('*', prettyJSON())
// JSON responses are formatted with indentation
```

## Integration with Effect

Hono works seamlessly with Effect for business logic:

```typescript
import { Hono } from 'hono'
import { Effect } from 'effect'

const app = new Hono()

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

export default app
```

## Server-Side Rendering with React

Hono makes React SSR simple:

```typescript
import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'

const app = new Hono()

// React component
function HomePage() {
  return (
    <html lang="en">
      <head>
        <title>Sovrium</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <h1>Welcome to Sovrium</h1>
        <p>Built with Hono and React</p>
      </body>
    </html>
  )
}

// Render React component
app.get('/', (c) => {
  const html = renderToString(<HomePage />)
  return c.html(html)
})

// Dynamic data with React
app.get('/users/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const user = await fetchUser(id)

  const html = renderToString(
    <html lang="en">
      <head>
        <title>{user.name} - Profile</title>
      </head>
      <body>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </body>
    </html>
  )

  return c.html(html)
})

export default app
```

## Type-Safe Routing

Hono provides excellent type inference:

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/users/:id', (c) => {
  const id = c.req.param('id') // Type: string
  return c.json({ id })
})

// Typed params with Zod or Effect Schema
import { z } from 'zod'

const userSchema = z.object({
  id: z.string(),
})

app.get('/users/:id', async (c) => {
  const { id } = userSchema.parse(c.req.param())
  return c.json({ id })
})
```

## Testing Hono Routes

Test Hono apps with Bun Test:

```typescript
import { test, expect } from 'bun:test'
import app from './index'

test('GET / returns hello message', async () => {
  const req = new Request('http://localhost/')
  const res = await app.fetch(req)

  expect(res.status).toBe(200)
  expect(await res.text()).toBe('Hello Hono!')
})

test('GET /users/:id returns user', async () => {
  const req = new Request('http://localhost/users/123')
  const res = await app.fetch(req)

  expect(res.status).toBe(200)

  const data = await res.json()
  expect(data.id).toBe('123')
})

test('POST /users creates user', async () => {
  const req = new Request('http://localhost/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
  })

  const res = await app.fetch(req)

  expect(res.status).toBe(201)
})
```

## Common Patterns in Sovrium

### Pattern 1: RESTful API

```typescript
import { Hono } from 'hono'

const app = new Hono()

// List all users
app.get('/api/users', async (c) => {
  const users = await fetchAllUsers()
  return c.json(users)
})

// Get single user
app.get('/api/users/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const user = await fetchUser(id)

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json(user)
})

// Create user
app.post('/api/users', async (c) => {
  const body = await c.req.json()
  const user = await createUser(body)
  return c.json(user, 201)
})

// Update user
app.put('/api/users/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const user = await updateUser(id, body)
  return c.json(user)
})

// Delete user
app.delete('/api/users/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await deleteUser(id)
  return c.json({ success: true })
})

export default app
```

### Pattern 2: Nested Routes

```typescript
import { Hono } from 'hono'

const app = new Hono()

// API routes
const api = app.basePath('/api')

// Users
const users = api.basePath('/users')
users.get('/', (c) => c.json([]))
users.get('/:id', (c) => c.json({ id: c.req.param('id') }))

// Posts
const posts = api.basePath('/posts')
posts.get('/', (c) => c.json([]))
posts.get('/:id', (c) => c.json({ id: c.req.param('id') }))

// Nested: User posts
users.get('/:userId/posts', (c) => {
  const userId = c.req.param('userId')
  return c.json({ userId, posts: [] })
})

export default app
```

### Pattern 3: Authentication Middleware

```typescript
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

const app = new Hono()

// Public routes
app.get('/', (c) => c.text('Public'))

// Protected routes with authentication
app.use(
  '/api/*',
  bearerAuth({
    token: process.env.API_TOKEN,
  })
)

app.get('/api/protected', (c) => {
  return c.json({ message: 'Authenticated' })
})

export default app
```

### Pattern 4: File Upload

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.post('/upload', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File

  if (!file) {
    return c.json({ error: 'No file uploaded' }, 400)
  }

  // Save file
  const buffer = await file.arrayBuffer()
  await Bun.write(`uploads/${file.name}`, buffer)

  return c.json({ filename: file.name, size: file.size })
})

export default app
```

## Hono vs Other Frameworks

| Aspect              | Hono         | Express      | Fastify      |
| ------------------- | ------------ | ------------ | ------------ |
| **Bundle Size**     | <14kB        | ~200kB       | ~100kB       |
| **Performance**     | Blazing fast | Moderate     | Fast         |
| **Runtime Support** | Multi        | Node.js only | Node.js only |
| **TypeScript**      | Excellent    | Moderate     | Good         |
| **Web Standards**   | Yes          | No           | No           |
| **Middleware**      | Rich         | Very Rich    | Rich         |
| **Learning Curve**  | Easy         | Easy         | Moderate     |

## Best Practices

1. **Use Middleware Wisely**: Apply middleware only where needed (not globally)
2. **Validate Input**: Always validate request data (use Effect Schema or Zod)
3. **Handle Errors**: Use `try/catch` and global error handler
4. **Type Safety**: Leverage TypeScript for route params and responses
5. **Organize Routes**: Use `basePath` for route grouping
6. **Use Effect for Business Logic**: Keep Hono handlers thin, business logic in Effect
7. **Test Routes**: Write unit tests for route handlers
8. **Return Proper Status Codes**: Use correct HTTP status codes (200, 201, 404, 500)
9. **Secure Routes**: Add authentication middleware for protected routes
10. **Enable CORS**: Configure CORS for cross-origin requests

## Common Pitfalls

- ❌ **Not Calling `await next()`**: Middleware must call `await next()` to continue
- ❌ **Forgetting `await`**: Use `await c.req.json()` for async body parsing
- ❌ **Mixing Response Methods**: Return only once per handler
- ❌ **Not Handling Errors**: Always wrap async operations in try/catch
- ❌ **Ignoring Status Codes**: Use proper HTTP status codes (404, 500, etc.)
- ❌ **Over-Using Middleware**: Only apply middleware where needed

## Integration with Bun

- **Native Execution**: Hono runs natively on Bun without adapters
- **Fast Startup**: Bun's speed makes Hono even faster
- **Built-in Server**: Use `Bun.serve()` or `export default app` for Bun
- **Hot Reload**: Use `bun --watch` for development

**Bun Server Example**:

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Bun!'))

export default app
```

**Run**:

```bash
bun run src/index.ts
```

## When to Use Hono

**Use Hono for:**

- Building fast, lightweight APIs
- Server-side rendering React components
- Multi-runtime applications (Bun, Cloudflare, Deno, AWS)
- Type-safe web applications with TypeScript
- Microservices and serverless functions
- Projects requiring minimal bundle size

**Consider alternatives for:**

- Projects deeply tied to Node.js ecosystem
- Applications requiring very specific Express middleware
- Teams unfamiliar with Web Standard APIs

## Full Documentation Reference

This is a high-level summary of Hono. For comprehensive documentation covering all features, middleware, and advanced topics, see the split documentation sections:

**Location**: `docs/infrastructure/framework/hono/`

The full documentation (12,797 lines) is split into 97 sections covering:

- All built-in middleware (auth, cache, compress, CORS, CSRF, etc.)
- Advanced routing patterns
- WebSocket support
- Streaming responses
- Custom middleware creation
- Testing strategies
- Deployment guides
- Performance optimization
- Real-world examples

To explore specific topics in depth, refer to the numbered section files in the `hono/` directory.

## References

- Hono documentation: https://hono.dev/
- Hono GitHub: https://github.com/honojs/hono
- Hono Discord: https://discord.gg/hono
- Middleware: https://hono.dev/docs/middleware
- Bun integration: https://hono.dev/docs/getting-started/bun
