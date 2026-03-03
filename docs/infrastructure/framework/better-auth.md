# Better Auth - Authentication Library

## Overview

**Version**: ^1.5.1
**Purpose**: Framework-agnostic authentication and authorization library for TypeScript
**Full Reference**: https://better-auth.com/llms.txt

## Sovrium-Specific Configuration

### File Structure

```
src/infrastructure/auth/better-auth/
├── auth.ts              # Factory: createAuthInstance(authConfig?)
├── layer.ts             # Effect Context.Tag + createAuthLayer(authConfig?)
├── schema.ts            # Drizzle schema in pgSchema('auth')
├── email-handlers.ts    # Email handler factory with variable substitution
├── index.ts             # Exports: auth, Auth, AuthLive, createAuthLayer, AuthError
└── plugins/
    ├── admin.ts         # Admin plugin (always enabled when auth configured)
    ├── two-factor.ts    # Two-factor plugin (conditional)
    └── magic-link.ts    # Magic link plugin (conditional)
```

### Environment Variables

| Variable                   | Purpose             | Note                         |
| -------------------------- | ------------------- | ---------------------------- |
| `AUTH_SECRET`              | Encryption secret   | NOT `BETTER_AUTH_SECRET`     |
| `BASE_URL`                 | Base URL of app     | NOT `BETTER_AUTH_URL`        |
| `{PROVIDER}_CLIENT_ID`     | OAuth client ID     | e.g., `GOOGLE_CLIENT_ID`     |
| `{PROVIDER}_CLIENT_SECRET` | OAuth client secret | e.g., `GOOGLE_CLIENT_SECRET` |

### Factory Pattern

Sovrium uses a factory function instead of a static singleton:

```typescript
// src/infrastructure/auth/better-auth/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export function createAuthInstance(authConfig?: Auth) {
  return betterAuth({
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: false, // CRITICAL: GitHub #5879 fix
      schema: drizzleSchema, // Model names as keys, NOT table names
    }),
    emailAndPassword: buildEmailAndPasswordConfig(authConfig, handlers),
    socialProviders: buildSocialProviders(authConfig),
    plugins: buildAuthPlugins(handlers, authConfig),
    rateLimit: buildRateLimitConfig(),
    hooks: buildAuthHooks(),
    // ...
  })
}

// Default instance for OpenAPI schema generation only
export const auth = createAuthInstance()
```

### Effect Layer Integration

Auth is exposed as an Effect Context service for dependency injection:

```typescript
// src/infrastructure/auth/better-auth/layer.ts
export class Auth extends Context.Tag('Auth')<
  Auth,
  {
    readonly api: ReturnType<typeof createAuthInstance>['api']
    readonly handler: ReturnType<typeof createAuthInstance>['handler']
    readonly getSession: (headers: Headers) => Effect.Effect<Session | null, AuthError>
    readonly requireSession: (headers: Headers) => Effect.Effect<Session, AuthError>
  }
>() {}

// Factory: creates Layer with app-specific auth configuration
export const createAuthLayer = (authConfig?: AuthConfig): Layer.Layer<Auth> => {
  const authInstance = createAuthInstance(authConfig)
  return Layer.succeed(
    Auth,
    Auth.of({
      /* ... */
    })
  )
}

// @deprecated — use createAuthLayer(authConfig) instead
export const AuthLive = createAuthLayer()
```

**Usage in Application Layer**:

```typescript
const protectedProgram = Effect.gen(function* () {
  const authService = yield* Auth
  const session = yield* authService.requireSession(headers)
  return { userId: session.user.id, email: session.user.email }
})
```

### PostgreSQL Schema Isolation

All auth tables live in a dedicated `auth` PostgreSQL schema (not `public`):

```typescript
// src/infrastructure/auth/better-auth/schema.ts
import { pgSchema } from 'drizzle-orm/pg-core'

export const authSchema = pgSchema('auth')

export const users = authSchema.table('user', {
  /* ... */
})
export const sessions = authSchema.table('session', {
  /* ... */
})
export const accounts = authSchema.table('account', {
  /* ... */
})
export const verifications = authSchema.table('verification', {
  /* ... */
})
export const twoFactors = authSchema.table('two_factor', {
  /* ... */
})
```

**Why**: Prevents conflicts when Sovrium users create their own tables in `public` schema.

### Drizzle Adapter Configuration

```typescript
const drizzleSchema = {
  user: users, // Key = Better Auth model name (NOT table name)
  session: sessions,
  account: accounts,
  verification: verifications,
  twoFactor: twoFactors,
}

database: drizzleAdapter(db, {
  provider: 'pg',
  usePlural: false, // Better Auth expects singular model names
  schema: drizzleSchema, // Explicit schema mapping (GitHub #5879 fix)
})
```

### Rate Limiting Architecture

Better Auth's native rate limiting is **disabled** due to upstream bugs (GitHub #392, #1891, #2153).

Instead, custom Hono middleware handles rate limiting in `auth-routes.ts`:

| Endpoint                           | Limit              | Window     |
| ---------------------------------- | ------------------ | ---------- |
| `/api/auth/sign-in/email`          | 5 attempts         | 60 seconds |
| `/api/auth/sign-up/email`          | 5 attempts         | 60 seconds |
| `/api/auth/request-password-reset` | 3 attempts         | 60 seconds |
| `/api/auth/admin/*`                | General rate limit | Per-IP     |

### Custom Auth Hooks

One custom hook via `createAuthMiddleware`:

1. **Admin createUser password validation** (Better Auth #4651 workaround):
   - Validates password length (min 8, max 128) on `/admin/create-user`
   - Admin plugin doesn't respect `emailAndPassword` validation settings

**Note**: The `/change-email` endpoint uses Better Auth 1.5's native email enumeration protection —
it always returns 200 OK regardless of whether the target email exists. This follows OWASP best
practices by preventing email enumeration attacks.

### Plugin Configuration

| Plugin      | When Enabled                      | Config                                                                                             |
| ----------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `openAPI`   | Always                            | `{ disableDefaultReference: true }`                                                                |
| `admin`     | When `authConfig` exists          | `defaultRole: authConfig.defaultRole ?? 'member'`, `adminRoles: ['admin']`, `firstUserAdmin: true` |
| `twoFactor` | When `authConfig?.twoFactor`      | No arguments (modelName removed)                                                                   |
| `magicLink` | When `magicLink` strategy enabled | `sendMagicLink` handler from email-handlers                                                        |

### Email Handlers

Factory pattern in `email-handlers.ts`:

- `createEmailHandlers(authConfig?)` returns `{ passwordReset, verification, magicLink }`
- Supports custom templates with variable substitution: `$name`, `$url`, `$email`, `$organizationName`, `$inviterName`
- Silent error handling (prevents user enumeration attacks)

### Auth Routes Setup

```typescript
// src/infrastructure/server/route-setup/auth-routes.ts
export function setupAuthRoutes(honoApp, app?) {
  if (!app?.auth) return honoApp // No auth = all /api/auth/* returns 404

  const authInstance = createAuthInstance(app.auth)

  // 1. Auth check middleware for admin routes (401 before parameter validation)
  // 2. Rate limiting middleware for admin routes
  // 3. Auth rate limiting for sign-in/sign-up/password-reset
  // 4. Mount Better Auth handler at /api/auth/*

  return appWithRateLimit.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
```

### Session Configuration

Sovrium uses Better Auth's **default session settings** — no explicit session config is provided. See the official docs for default values.

### Security Settings

```typescript
advanced: {
  useSecureCookies: process.env.NODE_ENV === 'production',
  disableCSRFCheck: process.env.NODE_ENV !== 'production',
},
trustedOrigins: ['*'],
```

## References

- Official documentation: https://better-auth.com/
- LLM-optimized reference: https://better-auth.com/llms.txt
- GitHub: https://github.com/better-auth/better-auth
