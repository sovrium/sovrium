# Better Auth - Framework-Agnostic Authentication Library

## Overview

**Version**: ^1.4.4 (minimum 1.4.4, allows patch/minor updates)
**Purpose**: Framework-agnostic authentication and authorization library for TypeScript providing type-safe auth flows with built-in support for email/password, social providers, 2FA, passkeys, and extensible plugin ecosystem

Better Auth is a comprehensive authentication library designed to work seamlessly with any TypeScript framework. It provides production-ready auth features out of the box while remaining flexible and extensible through a powerful plugin system.

## Why Better Auth for Sovrium

- **Framework Agnostic**: Works with Hono, React, Next.js, and all major frameworks
- **TypeScript First**: Full type safety for auth flows, errors, and sessions
- **Built-in Features**: Email/password, OAuth providers, sessions, 2FA, passkeys
- **Plugin Ecosystem**: Extend with magic links, email OTP, multi-tenancy, SSO
- **Bun Compatible**: Runs natively on Bun runtime with native TypeScript execution
- **Effect Integration**: Works seamlessly with Effect.ts for business logic
- **Database Flexibility**: Supports SQLite, PostgreSQL, MySQL, MongoDB via adapters
- **Zero Config Start**: Works out of the box with sensible defaults
- **Full Control**: Own your user data, customize auth flows completely
- **No Vendor Lock-in**: Run in your infrastructure, scale without per-user costs

## Core Concepts

### 1. Better Auth Server Instance

The server instance handles authentication logic and routes:

```typescript
import { betterAuth } from 'better-auth'

export const auth = betterAuth({
  // Database connection
  database: {
    type: 'sqlite',
    database: './db.sqlite',
  },

  // Environment variables
  secret: process.env.BETTER_AUTH_SECRET, // Required for encryption
  baseURL: process.env.BETTER_AUTH_URL, // Base URL of your app

  // Authentication methods
  emailAndPassword: {
    enabled: true,
    autoSignIn: true, // Auto sign in after signup
  },

  // Social providers
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  // Plugins
  plugins: [
    // Add plugins here
  ],
})
```

### 2. Authentication Methods

Better Auth provides multiple built-in authentication methods:

#### Email and Password

```typescript
// Server configuration
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true, // Sign in after signup
  },
})

// Client usage - Sign Up
import { authClient } from '@/lib/auth-client'

const { data, error } = await authClient.signUp.email(
  {
    email: 'user@example.com',
    password: 'securePassword123',
    name: 'Alice Johnson',
    image: 'https://example.com/avatar.jpg', // Optional
    callbackURL: '/dashboard', // Redirect after email verification
  },
  {
    onRequest: () => {
      // Show loading state
    },
    onSuccess: (ctx) => {
      // Redirect or show success
    },
    onError: (ctx) => {
      // Display error message
      alert(ctx.error.message)
    },
  }
)

// Client usage - Sign In
const { data, error } = await authClient.signIn.email({
  email: 'user@example.com',
  password: 'securePassword123',
  callbackURL: '/dashboard',
  rememberMe: true, // Persist session after browser close
})
```

#### Social Sign-On (OAuth)

Supported providers: GitHub, Google, Apple, Microsoft, Discord, Facebook, Twitter, LinkedIn, and more.

```typescript
// Server configuration
export const auth = betterAuth({
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    },
  },
})

// Client usage
import { authClient } from '@/lib/auth-client'

// Redirect to OAuth provider
await authClient.signIn.social({
  provider: 'github',
  callbackURL: '/dashboard',
})

// Or use a button
<button onClick={() => authClient.signIn.social({ provider: 'google' })}>
  Sign in with Google
</button>
```

#### Sign Out

```typescript
import { authClient } from '@/lib/auth-client'

await authClient.signOut({
  fetchOptions: {
    onSuccess: () => {
      // Redirect to login page
      window.location.href = '/login'
    },
  },
})
```

### 3. Session Management

Access user session data from client and server.

> **For managing authentication state with TanStack Query**, including caching, optimistic updates, and React integration patterns, see [TanStack Query Authentication Patterns](../../ui/tanstack-query.md#authentication-with-better-auth).

#### Client-Side Session

```typescript
import { authClient } from '@/lib/auth-client'

// Using React hook (recommended)
function UserProfile() {
  const {
    data: session, // Session data
    isPending, // Loading state
    error, // Error object
    refetch, // Refetch session
  } = authClient.useSession()

  if (isPending) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!session) return <div>Not authenticated</div>

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Email: {session.user.email}</p>
      <button onClick={() => authClient.signOut()}>Sign Out</button>
    </div>
  )
}

// Using getSession (without hook)
const { data: session, error } = await authClient.getSession()
```

#### Server-Side Session

```typescript
import { auth } from './auth' // Better Auth instance

// Hono example
import { Hono } from 'hono'

const app = new Hono()

app.get('/api/profile', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({
    user: session.user,
    session: session.session,
  })
})

export default app
```

### 4. Database Configuration

Better Auth supports multiple databases and ORMs:

#### Direct Database Connection

```typescript
import { betterAuth } from 'better-auth'

// SQLite
import Database from 'better-sqlite3'

export const auth = betterAuth({
  database: new Database('./sqlite.db'),
})

// PostgreSQL
import { Pool } from 'pg'

export const auth = betterAuth({
  database: new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'mydb',
  }),
})

// MySQL
import { createPool } from 'mysql2/promise'

export const auth = betterAuth({
  database: createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'mydb',
  }),
})
```

#### ORM Adapters

```typescript
import { betterAuth } from 'better-auth'

// Drizzle ORM
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db' // Your Drizzle instance

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg', // or 'mysql', 'sqlite'
  }),
})

// Prisma
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql', // or 'mysql', 'sqlite'
  }),
})

// MongoDB
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { client } from '@/db' // Your MongoDB client

export const auth = betterAuth({
  database: mongodbAdapter(client),
})
```

### 5. Plugin System

Better Auth provides a rich plugin ecosystem:

#### Using Plugins (Server)

```typescript
import { betterAuth } from 'better-auth'
import { twoFactor, magicLink, username } from 'better-auth/plugins'

export const auth = betterAuth({
  // ...other config
  plugins: [
    twoFactor({
      issuer: 'My App',
    }),
    magicLink({
      sendMagicLink: async (email, magicLink) => {
        // Send email with magic link
        await sendEmail(email, magicLink)
      },
    }),
    username(),
  ],
})
```

#### Using Plugins (Client)

```typescript
import { createAuthClient } from 'better-auth/react'
import { twoFactorClient, magicLinkClient, usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [
    twoFactorClient({
      twoFactorPage: '/two-factor', // Redirect page for 2FA
    }),
    magicLinkClient(),
    usernameClient(),
  ],
})

// Using two-factor plugin
const enableTwoFactor = async () => {
  const data = await authClient.twoFactor.enable({
    password: 'userPassword',
  })
  // Display QR code: data.qrCode
}

const verifyTOTP = async (code: string) => {
  const data = await authClient.twoFactor.verifyTOTP({
    code,
    trustDevice: true, // Remember device
  })
}

// Using magic link plugin
const sendMagicLink = async () => {
  await authClient.signIn.magicLink({
    email: 'user@example.com',
    callbackURL: '/dashboard',
  })
}

// Using username plugin
const signUpWithUsername = async () => {
  await authClient.signUp.username({
    username: 'alice',
    password: 'securePassword123',
    name: 'Alice Johnson',
  })
}
```

### 6. Popular Plugins

Better Auth includes many built-in plugins:

#### Two-Factor Authentication (2FA)

```typescript
import { twoFactor } from 'better-auth/plugins'
import { twoFactorClient } from 'better-auth/client/plugins'

// Server
export const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: 'My App', // App name in authenticator
      totpWindow: 1, // TOTP tolerance window
    }),
  ],
})

// Client
const { data } = await authClient.twoFactor.enable({ password: 'userPassword' })
// Returns QR code for Google Authenticator, Authy, etc.

await authClient.twoFactor.verifyTOTP({
  code: '123456',
  trustDevice: true,
})
```

#### Passkeys (WebAuthn)

```typescript
import { passkey } from 'better-auth/plugins'
import { passkeyClient } from 'better-auth/client/plugins'

// Server
export const auth = betterAuth({
  plugins: [
    passkey({
      rpName: 'My App',
      rpID: 'example.com',
    }),
  ],
})

// Client - Register passkey
await authClient.passkey.register({
  email: 'user@example.com',
  name: 'Alice',
})

// Client - Sign in with passkey
await authClient.signIn.passkey()
```

#### Magic Link

```typescript
import { magicLink } from 'better-auth/plugins'
import { magicLinkClient } from 'better-auth/client/plugins'

// Server
export const auth = betterAuth({
  plugins: [
    magicLink({
      sendMagicLink: async (email, magicLink) => {
        await sendEmail(email, {
          subject: 'Sign in to My App',
          body: `Click here to sign in: ${magicLink}`,
        })
      },
    }),
  ],
})

// Client
await authClient.signIn.magicLink({
  email: 'user@example.com',
  callbackURL: '/dashboard',
})
```

#### Email OTP

```typescript
import { emailOTP } from 'better-auth/plugins'
import { emailOTPClient } from 'better-auth/client/plugins'

// Server
export const auth = betterAuth({
  plugins: [
    emailOTP({
      sendOTP: async (email, otp) => {
        await sendEmail(email, {
          subject: 'Your OTP Code',
          body: `Your code is: ${otp}`,
        })
      },
    }),
  ],
})

// Client - Send OTP
await authClient.emailOTP.sendOTP({
  email: 'user@example.com',
})

// Client - Verify OTP
await authClient.emailOTP.verifyOTP({
  email: 'user@example.com',
  otp: '123456',
})
```

#### Organization (Multi-Tenancy)

```typescript
import { organization } from 'better-auth/plugins'
import { organizationClient } from 'better-auth/client/plugins'

// Server
export const auth = betterAuth({
  plugins: [organization()],
})

// Client - Create organization
await authClient.organization.create({
  name: 'Acme Corp',
  slug: 'acme-corp',
})

// Client - Invite member
await authClient.organization.inviteMember({
  organizationId: 'org-123',
  email: 'member@example.com',
  role: 'member',
})

// Client - List organizations
const orgs = await authClient.organization.list()
```

### 7. Integration with Hono

Mount Better Auth routes in Hono:

```typescript
import { Hono } from 'hono'
import { auth } from './auth' // Better Auth instance

const app = new Hono()

// Mount Better Auth handler at /api/auth/*
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Protected route using session
app.get('/api/profile', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({
    user: session.user,
    email: session.user.email,
  })
})

// Public route
app.get('/api/public', (c) => {
  return c.json({ message: 'Public endpoint' })
})

export default app
```

### 8. Integration with React

Create Better Auth client for React:

```typescript
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL, // or VITE_BETTER_AUTH_URL
})

// components/LoginForm.tsx
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: '/dashboard',
    })

    if (error) {
      alert(error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Sign In</button>
    </form>
  )
}

// components/UserProfile.tsx
import { authClient } from '@/lib/auth-client'

export function UserProfile() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <div>Loading...</div>
  if (!session) return <div>Not signed in</div>

  return (
    <div>
      <h1>{session.user.name}</h1>
      <p>{session.user.email}</p>
      <button onClick={() => authClient.signOut()}>Sign Out</button>
    </div>
  )
}
```

### 9. Integration with Effect

Better Auth works seamlessly with Effect for business logic:

```typescript
import { Effect, Context, Layer } from 'effect'
import { auth } from './auth'

// Define Better Auth service
class BetterAuthService extends Context.Tag('BetterAuthService')<
  BetterAuthService,
  {
    readonly getSession: (headers: Headers) => Effect.Effect<Session | null, AuthError, never>
    readonly requireSession: (headers: Headers) => Effect.Effect<Session, AuthError, never>
  }
>() {}

// Define errors
class AuthError extends Error {
  readonly _tag = 'AuthError'
  constructor(message: string) {
    super(message)
  }
}

// Implement Better Auth service
const BetterAuthServiceLive = Layer.succeed(BetterAuthService, {
  getSession: (headers) =>
    Effect.tryPromise({
      try: () => auth.api.getSession({ headers }),
      catch: (error) => new AuthError('Failed to get session'),
    }),
  requireSession: (headers) =>
    Effect.gen(function* () {
      const session = yield* Effect.tryPromise({
        try: () => auth.api.getSession({ headers }),
        catch: (error) => new AuthError('Failed to get session'),
      })

      if (!session) {
        return yield* Effect.fail(new AuthError('Unauthorized'))
      }

      return session
    }),
})

// Use in Hono route with Effect
import { Hono } from 'hono'

const app = new Hono()

app.get('/api/protected', async (c) => {
  const program = Effect.gen(function* () {
    const authService = yield* BetterAuthService
    const session = yield* authService.requireSession(c.req.raw.headers)

    return {
      message: 'Protected data',
      user: session.user,
    }
  }).pipe(Effect.provide(BetterAuthServiceLive))

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json({ error: result.left.message }, 401)
  }

  return c.json(result.right)
})

export default app
```

## Common Patterns in Sovrium

### Pattern 1: Authentication Middleware

```typescript
import { Hono } from 'hono'
import { auth } from './auth'

const app = new Hono()

// Create auth middleware
const authMiddleware = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Attach session to context
  c.set('session', session)
  await next()
}

// Public routes
app.get('/api/public', (c) => c.json({ message: 'Public' }))

// Protected routes
app.use('/api/protected/*', authMiddleware)

app.get('/api/protected/profile', (c) => {
  const session = c.get('session')
  return c.json({ user: session.user })
})

export default app
```

### Pattern 2: Role-Based Access Control

```typescript
import { Hono } from 'hono'
import { auth } from './auth'

const app = new Hono()

// Role check middleware
const requireRole = (role: string) => {
  return async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (session.user.role !== role) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    c.set('session', session)
    await next()
  }
}

// Admin-only route
app.use('/api/admin/*', requireRole('admin'))

app.get('/api/admin/users', (c) => {
  return c.json({ message: 'Admin access' })
})

export default app
```

### Pattern 3: Custom User Fields

```typescript
import { betterAuth } from 'better-auth'

// Extend user schema with additional fields
export const auth = betterAuth({
  database: /* ... */,
  user: {
    additionalFields: {
      phoneNumber: {
        type: 'string',
        required: false,
      },
      bio: {
        type: 'string',
        required: false,
      },
      dateOfBirth: {
        type: 'date',
        required: false,
      },
    },
  },
})

// Update user with additional fields
await auth.api.updateUser({
  body: {
    userId: '123',
    phoneNumber: '+1234567890',
    bio: 'Software developer',
  },
})
```

### Pattern 4: Email Verification

```typescript
import { betterAuth } from 'better-auth'

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendVerificationEmail: async (email, verificationToken) => {
      const verificationLink = `${process.env.BETTER_AUTH_URL}/api/auth/verify-email?token=${verificationToken}`

      await sendEmail(email, {
        subject: 'Verify your email',
        body: `Click here to verify: ${verificationLink}`,
      })
    },
  },
})

// Client - check verification status
const session = await authClient.getSession()
if (session && !session.user.emailVerified) {
  // Show verification notice
}
```

## Database Schema

Better Auth requires core database tables. Use the CLI to generate schema:

```bash
# Generate schema for your ORM/database (Bun-first approach)
bunx @better-auth/cli generate

# Apply migration directly (Kysely only)
bunx @better-auth/cli migrate
```

**Core tables:**

- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth provider accounts
- `verification` - Email verification tokens

**Plugin tables** (added by plugins):

- Two-Factor: `twoFactor` table
- Passkey: `passkey` table
- Organization: `organization`, `member`, `invitation` tables

## CLI Commands

Better Auth provides a CLI for schema management:

```bash
# Generate schema/migration (Bun-first approach)
bunx @better-auth/cli generate

# Apply migration (Kysely only)
bunx @better-auth/cli migrate

# View current schema
bunx @better-auth/cli schema
```

## Security Features

Better Auth includes built-in security best practices:

- **Password hashing**: Bcrypt with configurable rounds
- **CSRF protection**: Built-in CSRF token validation
- **Session security**: HttpOnly cookies, secure flags
- **Rate limiting**: Plugin for API rate limiting
- **Email verification**: Optional email verification flow
- **2FA support**: TOTP, SMS, email OTP
- **Passkeys**: WebAuthn passwordless authentication

## Testing Better Auth Routes

Test authentication flows with Bun Test:

```typescript
import { test, expect } from 'bun:test'
import { auth } from './auth'

test('sign up creates new user', async () => {
  const response = await auth.api.signUpEmail({
    body: {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    },
  })

  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.user.email).toBe('test@example.com')
})

test('sign in with valid credentials', async () => {
  const response = await auth.api.signInEmail({
    body: {
      email: 'test@example.com',
      password: 'password123',
    },
  })

  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.session).toBeDefined()
})
```

## Better Auth vs Other Solutions

| Aspect                 | Better Auth    | Auth.js (NextAuth) | Lucia Auth  | Clerk        |
| ---------------------- | -------------- | ------------------ | ----------- | ------------ |
| **Framework Support**  | All frameworks | Next.js focused    | All         | All          |
| **TypeScript**         | Excellent      | Good               | Excellent   | Good         |
| **Built-in Features**  | Very Rich      | Basic              | Minimal     | Very Rich    |
| **Plugin System**      | Yes            | Limited            | No          | No           |
| **Self-Hosted**        | Yes            | Yes                | Yes         | No (SaaS)    |
| **Database Control**   | Full           | Full               | Full        | No (managed) |
| **Cost**               | Free           | Free               | Free        | Paid         |
| **Bundle Size**        | Small          | Medium             | Tiny        | Large (SDK)  |
| **Social Providers**   | 15+            | 50+                | DIY         | Many         |
| **2FA/Passkeys**       | Built-in       | Via plugins        | DIY         | Built-in     |
| **Session Management** | Built-in       | Built-in           | Manual      | Built-in     |
| **Learning Curve**     | Easy           | Medium             | Steep (DIY) | Easy         |
| **Vendor Lock-in**     | None           | None               | None        | High (SaaS)  |
| **Bun Compatibility**  | Native         | Works              | Native      | Works        |
| **Effect Integration** | Easy           | Manual             | Manual      | Manual       |

## Best Practices

1. **Use Environment Variables**: Never hardcode secrets
2. **Enable HTTPS**: Use secure connections in production
3. **Implement Rate Limiting**: Protect against brute force attacks
4. **Verify Emails**: Require email verification for sensitive apps
5. **Use 2FA for Admins**: Enable two-factor for privileged accounts
6. **Validate Input**: Always validate auth-related input
7. **Handle Errors Gracefully**: Provide user-friendly error messages
8. **Test Auth Flows**: Write tests for sign up, sign in, sign out
9. **Session Security**: Use HttpOnly cookies, secure flags
10. **Database Migrations**: Run migrations before deployment

## Common Pitfalls

- ❌ **Forgetting Environment Variables**: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` required
- ❌ **Not Running Migrations**: Run `@better-auth/cli migrate` after adding plugins
- ❌ **Wrong baseURL**: Client `baseURL` must match server URL
- ❌ **Missing Headers**: Server session requires `headers` object
- ❌ **Not Handling Errors**: Always check `error` from client methods
- ❌ **Hardcoded Secrets**: Use environment variables for all secrets
- ❌ **Skipping Email Verification**: Enable for production apps

## When to Use Better Auth

**Use Better Auth for:**

- Building apps with Hono, Bun, React, or any TypeScript framework
- Projects requiring full control over user data
- Applications needing type-safe authentication
- Self-hosted auth without vendor lock-in
- Apps requiring advanced features (2FA, passkeys, multi-tenancy)
- Projects using Effect.ts for business logic

**Consider alternatives for:**

- Teams wanting managed auth service (use Clerk, Auth0)
- Next.js-only projects (Auth.js might be simpler)
- Projects requiring minimal auth library (use Lucia)

## Integration with Bun

- **Native Execution**: Better Auth runs natively on Bun
- **Fast Startup**: Bun's speed makes auth flows faster
- **TypeScript Support**: Direct TypeScript execution without compilation
- **Environment Variables**: Bun automatically loads `.env` files

## Full Documentation Reference

This is a high-level summary of Better Auth. For comprehensive documentation covering all features, plugins, and advanced topics, see the split documentation sections:

**Location**: `docs/infrastructure/framework/better-auth/`

The full documentation (33,792 lines) is split into 132 major sections covering:

- Complete authentication methods (email, social, passkeys, magic links, OTP)
- All built-in plugins (2FA, organizations, multi-session, rate limiting, etc.)
- Database adapters (Drizzle, Prisma, MongoDB, Kysely)
- Framework integrations (Hono, Next.js, SvelteKit, Nuxt, Remix, etc.)
- Advanced patterns (custom fields, webhooks, middleware)
- Session management strategies
- Security best practices
- Testing strategies
- Deployment guides
- Real-world examples

To explore specific topics in depth, refer to the numbered section files in the `better-auth/` directory.

## References

- Better Auth documentation: https://better-auth.com/
- Better Auth GitHub: https://github.com/better-auth/better-auth
- Better Auth Discord: https://discord.gg/better-auth
- Plugin documentation: https://better-auth.com/docs/plugins
- Examples: https://github.com/better-auth/better-auth/tree/main/examples
