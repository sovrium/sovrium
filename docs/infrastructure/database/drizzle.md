# Drizzle ORM - Type-Safe Database Operations

## Overview

**Purpose**: TypeScript-first ORM for SQL databases providing type-safe queries with zero-cost type safety and seamless integration with Bun, Effect.ts, and Better Auth

Drizzle ORM is a lightweight, performant ORM designed for TypeScript developers who want SQL-like syntax with full type inference. It integrates natively with Bun's SQL module for PostgreSQL connections and works seamlessly with Effect.ts for dependency injection and error handling.

> **Note**: This document provides a high-level summary with essential examples. For comprehensive coverage including advanced patterns, all query types, migration strategies, and detailed PostgreSQL optimizations, see the full documentation at `docs/infrastructure/database/drizzle/` directory.

## Why Drizzle for Sovrium

- **Zero Runtime Overhead**: Schema and query types resolved at compile time
- **SQL-Like Syntax**: Familiar SQL-style API (no learning curve for SQL developers)
- **Full TypeScript Inference**: Complete type safety from schema to query results
- **Bun Native Integration**: Uses Bun's built-in `bun:sql` module since v0.39.0 (no external drivers)
- **Effect.ts Ready**: Perfect for repository pattern with Effect Context
- **Better Auth Compatible**: Works with Better Auth via `drizzleAdapter`
- **PostgreSQL Focus**: Production-ready with advanced PostgreSQL features
- **Lightweight**: Small bundle size, minimal dependencies
- **Migration System**: Declarative migrations with drizzle-kit
- **Active Development**: Recent improvements include enhanced error handling (v0.44.0), advanced CTE operations (v0.39.0), and cross/lateral joins (v0.43.0)

## Installation

Drizzle is already installed in Sovrium:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.44.7",
    "@types/bun": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.7"
  }
}
```

No additional installation needed.

## Database Setup

### PostgreSQL with Bun SQL (Production)

Bun provides native PostgreSQL support via the built-in `bun:sql` module (added in Bun 1.2.0, with Drizzle support since v0.39.0):

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/bun-sql'

// Simplest form (recommended for most cases)
export const db = drizzle(process.env.DATABASE_URL!)
export type DrizzleDB = typeof db

// Alternative: With connection options
// export const db = drizzle({
//   connection: { url: process.env.DATABASE_URL! }
// })

// Alternative: With explicit client configuration
// import { SQL } from 'bun'
// const client = new SQL({
//   url: process.env.DATABASE_URL || 'postgres://localhost:5432/sovrium',
//   max: 20, // Connection pool size
//   idleTimeout: 60, // Idle timeout in seconds
//   connectionTimeout: 30, // Connection timeout in seconds
// })
// export const db = drizzle({ client })
```

**Environment Variables**:

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/sovrium
```

### Effect Layer for Database

Provide database as Effect Context service:

```typescript
// src/db/layer.ts
import { Context, Layer, Effect } from 'effect'
import { db, type DrizzleDB } from './index'

export class Database extends Context.Tag('Database')<Database, DrizzleDB>() {}

export const DatabaseLive = Layer.succeed(Database, db)
```

**Usage in Effect programs**:

```typescript
import { Effect } from 'effect'
import { Database } from '@/db/layer'

const program = Effect.gen(function* () {
  const db = yield* Database
  // Use db for queries
})
```

## Schema Definition

### Basic Table Schema

Define tables with type-safe columns:

```typescript
// src/db/schema/users.ts
import { pgTable, integer, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Infer TypeScript types from schema
export type User = typeof users.$inferSelect // Select type (all fields)
export type NewUser = typeof users.$inferInsert // Insert type (optional fields)
```

**Type Inference**:

```typescript
const user: User = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  emailVerified: false,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const newUser: NewUser = {
  name: 'Bob',
  email: 'bob@example.com',
  // id, createdAt, updatedAt are optional (auto-generated)
}
```

### Relationships

Define one-to-many and many-to-many relationships:

```typescript
// src/db/schema/posts.ts
import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'
import { relations } from 'drizzle-orm'

export const posts = pgTable('posts', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Define relations for type-safe joins
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}))

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))
```

## Query API

### Select Queries

```typescript
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq, and, or, like, gt, lt } from 'drizzle-orm'

// Select all users
const allUsers = await db.select().from(users)

// Select specific columns
const userNames = await db
  .select({
    id: users.id,
    name: users.name,
  })
  .from(users)

// Where conditions
const user = await db.select().from(users).where(eq(users.id, 1))

// Multiple conditions
const verifiedUsers = await db
  .select()
  .from(users)
  .where(and(eq(users.emailVerified, true), like(users.email, '%@example.com')))

// Limit and offset (pagination)
const page1 = await db.select().from(users).limit(10).offset(0)
```

### Insert, Update, Delete

```typescript
// Insert
const newUser = await db
  .insert(users)
  .values({
    name: 'Alice',
    email: 'alice@example.com',
  })
  .returning()

// Update
const updatedUser = await db
  .update(users)
  .set({ name: 'Alice Smith' })
  .where(eq(users.id, 1))
  .returning()

// Delete
await db.delete(users).where(eq(users.id, 1))
```

### Joins and Relations

```typescript
import { posts, users } from '@/db/schema'

// Manual join
const postsWithAuthors = await db
  .select({
    post: posts,
    author: users,
  })
  .from(posts)
  .leftJoin(users, eq(posts.authorId, users.id))

// Relational query (type-safe)
const usersWithPosts = await db.query.users.findMany({
  with: {
    posts: true,
  },
})
```

## Effect Integration with Repository Pattern

### Repository Interface

```typescript
// src/repositories/UserRepository.ts
import { Effect, Context, Layer } from 'effect'
import { Database } from '@/db/layer'
import { users, type User, type NewUser } from '@/db/schema'
import { eq } from 'drizzle-orm'

class UserNotFoundError {
  readonly _tag = 'UserNotFoundError'
  constructor(readonly userId: number) {}
}

class DatabaseError {
  readonly _tag = 'DatabaseError'
  constructor(readonly cause: unknown) {}
}

export class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User, UserNotFoundError | DatabaseError>
    readonly findByEmail: (email: string) => Effect.Effect<User | null, DatabaseError>
    readonly create: (user: NewUser) => Effect.Effect<User, DatabaseError>
    readonly update: (
      id: number,
      data: Partial<NewUser>
    ) => Effect.Effect<User, UserNotFoundError | DatabaseError>
    readonly delete: (id: number) => Effect.Effect<void, UserNotFoundError | DatabaseError>
    readonly list: () => Effect.Effect<readonly User[], DatabaseError>
  }
>() {}
```

### Repository Implementation

```typescript
export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* Database

    return UserRepository.of({
      findById: (id) =>
        Effect.tryPromise({
          try: async () => {
            const result = await db.select().from(users).where(eq(users.id, id))
            return result[0]
          },
          catch: (error) => new DatabaseError(error),
        }).pipe(
          Effect.flatMap((result) =>
            result ? Effect.succeed(result) : Effect.fail(new UserNotFoundError(id))
          )
        ),

      findByEmail: (email) =>
        Effect.tryPromise({
          try: async () => {
            const result = await db.select().from(users).where(eq(users.email, email))
            return result[0] || null
          },
          catch: (error) => new DatabaseError(error),
        }),

      create: (user) =>
        Effect.tryPromise({
          try: async () => {
            const result = await db.insert(users).values(user).returning()
            return result[0]
          },
          catch: (error) => new DatabaseError(error),
        }),

      update: (id, data) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const updated = await db.update(users).set(data).where(eq(users.id, id)).returning()
              return updated[0]
            },
            catch: (error) => new DatabaseError(error),
          })

          if (!result) {
            return yield* Effect.fail(new UserNotFoundError(id))
          }

          return result
        }),

      delete: (id) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const deleted = await db.delete(users).where(eq(users.id, id)).returning()
              return deleted[0]
            },
            catch: (error) => new DatabaseError(error),
          })

          if (!result) {
            return yield* Effect.fail(new UserNotFoundError(id))
          }
        }),

      list: () =>
        Effect.tryPromise({
          try: () => db.select().from(users),
          catch: (error) => new DatabaseError(error),
        }),
    })
  })
)
```

### Application Layer Usage

```typescript
// src/application/use-cases/GetUserProfile.ts
import { Effect } from 'effect'
import { UserRepository } from '@/repositories/UserRepository'

export const GetUserProfile = (userId: number) =>
  Effect.gen(function* () {
    const userRepo = yield* UserRepository

    const user = yield* userRepo.findById(userId)

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      joinedAt: user.createdAt,
    }
  })

// Provide dependencies and run
const program = GetUserProfile(1).pipe(Effect.provide(UserRepositoryLive))

const result = await Effect.runPromise(program.pipe(Effect.either))

if (result._tag === 'Left') {
  console.error('Error:', result.left)
} else {
  console.log('User:', result.right)
}
```

## Migrations with drizzle-kit

### Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### Generate and Run Migrations

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations to database
bun run db:migrate

# Push schema changes directly (development only - skips migrations)
bun run db:push

# View database schema in Drizzle Studio (database GUI)
bun run db:studio

# Check migration status
bun run db:check

# Drop migration
bun run db:drop
```

**Migration Workflow**:

1. Define or modify schema in `src/db/schema/*.ts`
2. Run `bun run db:generate` to create migration SQL
3. Review generated migration in `drizzle/` directory
4. Run `bun run db:migrate` to apply migration
5. Commit migration files to version control

**Alternative: Direct Push (Development Only)**:

For rapid iteration in development, you can skip migrations and push schema directly:

```bash
bun run db:push  # Applies schema changes without generating migration files
```

⚠️ **Warning**: `db:push` should only be used in development environments. Always use migrations (`db:generate` + `db:migrate`) for production.

## Better Auth Integration

Use `drizzleAdapter` to integrate Better Auth with Drizzle:

```typescript
// src/auth/index.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),

  emailAndPassword: {
    enabled: true,
  },
})
```

Better Auth automatically creates and manages tables:

- `users` - User accounts
- `sessions` - Active sessions
- `accounts` - OAuth provider accounts
- `verifications` - Email verification tokens

## Best Practices

### 1. Use Type Inference

```typescript
// ✅ CORRECT: Infer types from schema
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ❌ INCORRECT: Manual type definitions (out of sync risk)
type User = {
  id: number
  name: string
  email: string
}
```

### 2. Parameterized Queries (SQL Injection Prevention)

```typescript
// ✅ CORRECT: Drizzle uses parameterized queries automatically
const email = userInput.email
const user = await db.select().from(users).where(eq(users.email, email))

// ❌ INCORRECT: String concatenation (SQL injection risk)
const query = `SELECT * FROM users WHERE email = '${userInput.email}'`
const user = await db.execute(query) // Vulnerable to SQL injection!
```

### 3. Repository Pattern with Effect

```typescript
// ✅ CORRECT: Repository with Effect Context
export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* Database
    // Implementation
  })
)

// ❌ INCORRECT: Direct database access in application layer
const user = await db.select().from(users).where(eq(users.id, 1))
```

### 4. Use Relations for Type-Safe Joins

```typescript
// ✅ CORRECT: Relational query (type-safe)
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
})

// ❌ LESS IDEAL: Manual join (more verbose)
const result = await db.select().from(users).leftJoin(posts, eq(posts.authorId, users.id))
```

### 5. Transaction Management

```typescript
// ✅ CORRECT: Use transactions for multiple operations
await db.transaction(async (tx) => {
  const user = await tx.insert(users).values(newUser).returning()
  await tx.insert(posts).values({ authorId: user[0].id, title: 'First Post' })
})
```

## Common Patterns

### Pagination

```typescript
const PAGE_SIZE = 10

export const listUsersPaginated = (page: number) =>
  Effect.gen(function* () {
    const db = yield* Database

    const users = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(users)
          .limit(PAGE_SIZE)
          .offset(page * PAGE_SIZE),
      catch: (error) => new DatabaseError(error),
    })

    return users
  })
```

### Search with Filters

```typescript
import { like, or } from 'drizzle-orm'

export const searchUsers = (query: string) =>
  Effect.gen(function* () {
    const db = yield* Database

    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(users)
          .where(or(like(users.name, `%${query}%`), like(users.email, `%${query}%`))),
      catch: (error) => new DatabaseError(error),
    })

    return results
  })
```

## Performance Optimization

### Use Indexes

```typescript
// Define indexes in schema for frequent queries
export const users = pgTable(
  'users',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
  },
  (table) => ({
    emailIdx: index('email_idx').on(table.email),
    nameIdx: index('name_idx').on(table.name),
  })
)
```

### Select Only Needed Columns

```typescript
// ✅ CORRECT: Select specific columns
const userNames = await db
  .select({
    id: users.id,
    name: users.name,
  })
  .from(users)

// ❌ INCORRECT: Fetch all columns when only few needed
const allUsers = await db.select().from(users) // Wasteful if only need names
```

### Use Joins Instead of Multiple Queries (N+1 Problem)

```typescript
// ✅ CORRECT: Single query with join
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
})

// ❌ INCORRECT: N+1 queries
const users = await db.select().from(users)
const usersWithPosts = await Promise.all(
  users.map(async (user) => ({
    ...user,
    posts: await db.select().from(posts).where(eq(posts.authorId, user.id)),
  }))
)
```

## Common Pitfalls

- ❌ **Not using type inference** - Manually defining types that drift from schema
- ❌ **Forgetting migrations** - Modifying schema without generating migrations
- ❌ **N+1 queries** - Making separate queries in loops instead of joins
- ❌ **Ignoring indexes** - Not adding indexes for frequently queried columns
- ❌ **Skipping transactions** - Not using transactions for multi-step operations
- ❌ **Direct database access** - Bypassing repository pattern in application layer

## Drizzle vs Other ORMs

| Aspect                 | Drizzle ORM                  | Prisma                          | TypeORM                    |
| ---------------------- | ---------------------------- | ------------------------------- | -------------------------- |
| **Type Safety**        | Full (compile-time)          | Full (code generation required) | Partial (decorators)       |
| **Bundle Size**        | Small (~15KB)                | Large (~50KB+)                  | Large (~100KB+)            |
| **SQL-Like API**       | Yes (familiar to SQL users)  | No (custom query language)      | Yes (QueryBuilder)         |
| **Bun Native Support** | Yes (bun:sql module)         | No (needs external driver)      | No (needs external driver) |
| **Performance**        | Excellent (zero overhead)    | Good                            | Moderate                   |
| **Migrations**         | Declarative (drizzle-kit)    | Declarative (prisma migrate)    | Imperative or declarative  |
| **Effect Integration** | Seamless (natural fit)       | Manual wrapping needed          | Manual wrapping needed     |
| **Learning Curve**     | Low (SQL knowledge)          | Medium (custom DSL)             | Medium (decorators)        |
| **PostgreSQL Focus**   | Yes (all features supported) | Yes (all features)              | Yes (all features)         |

## Summary

Drizzle ORM in Sovrium provides:

1. **Zero-Cost Type Safety** - Full TypeScript inference from schema definitions
2. **Bun Native Integration** - Uses built-in `bun:sql` for PostgreSQL connections
3. **Effect-Ready** - Repository pattern with Effect Context and dependency injection
4. **SQL-Like Syntax** - Familiar query API for SQL developers
5. **Better Auth Compatible** - Works seamlessly via `drizzleAdapter`
6. **Migration System** - Declarative migrations with drizzle-kit
7. **Performance** - Lightweight, zero runtime overhead, optimized queries

By following the repository pattern with Effect.ts, Drizzle enables type-safe, testable, and maintainable database operations that align with Sovrium's functional programming principles and layer-based architecture.

## References

- Drizzle ORM documentation: https://orm.drizzle.team/
- Bun SQL module: https://bun.sh/docs/api/sql
- drizzle-kit migrations: https://orm.drizzle.team/kit-docs/overview
- Effect Context and Layer: https://effect.website/docs/context-management/layers
- Better Auth Drizzle adapter: https://www.better-auth.com/docs/adapters/drizzle
