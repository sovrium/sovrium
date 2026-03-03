# Drizzle ORM - Type-Safe Database Operations

## Overview

**Version**: ^0.45.1
**drizzle-kit Version**: ^0.31.9
**Purpose**: TypeScript-first ORM for PostgreSQL with SQL-like syntax and full type inference
**Full Reference**: https://orm.drizzle.team/llms.txt

## Why Drizzle for Sovrium

- **Zero Runtime Overhead**: Types resolved at compile time
- **SQL-Like Syntax**: Familiar API for SQL developers
- **Bun Native**: Uses `bun:sql` module (no external drivers)
- **Effect.ts Ready**: Repository pattern with Effect Context and Layer
- **Better Auth Compatible**: Via `drizzleAdapter` with schema mapping
- **PostgreSQL Focus**: Production-ready with advanced features

## Sovrium-Specific Configuration

### Database Connection

```typescript
// src/infrastructure/database/drizzle/db-bun.ts
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

export const db = drizzle({
  connection: { url: process.env.DATABASE_URL! },
  schema,
})

export type DrizzleDB = typeof db
```

### Effect Layer

```typescript
// src/infrastructure/database/drizzle/layer.ts
import { Context, Layer } from 'effect'

export class Database extends Context.Tag('Database')<Database, DrizzleDB>() {}
export const DatabaseLive = Layer.succeed(Database, db)
```

### Auth Schema Isolation

Auth tables use `pgSchema('auth')` to isolate from user tables:

```typescript
// src/infrastructure/auth/better-auth/schema.ts
import { pgSchema } from 'drizzle-orm/pg-core'

export const authSchema = pgSchema('auth')
export const users = authSchema.table('user', {
  /* ... */
})
```

### Better Auth Adapter

```typescript
database: drizzleAdapter(db, {
  provider: 'pg',
  usePlural: false, // Better Auth expects singular model names
  schema: {
    user: users, // Key = model name, NOT table name (GitHub #5879)
    session: sessions,
    account: accounts,
    verification: verifications,
    twoFactor: twoFactors,
  },
})
```

### Repository Pattern with Effect

```typescript
export class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User, UserNotFoundError | DatabaseError>
    readonly save: (user: User) => Effect.Effect<void, DatabaseError>
    readonly list: () => Effect.Effect<readonly User[], DatabaseError>
  }
>() {}

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
      // ...
    })
  })
)
```

### Migration Commands

```bash
bun run db:generate         # Generate migration from schema changes
bun run db:migrate          # Apply migrations to database
bun run db:push             # Push schema changes directly (dev only)
bun run db:studio           # Launch Drizzle Studio (database GUI)
bun run db:check            # Check migration status
bun run db:drop             # Drop migration
```

### Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/infrastructure/database/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
})
```

### Type Inference

```typescript
// Always infer types from schema
export type User = typeof users.$inferSelect // Select type
export type NewUser = typeof users.$inferInsert // Insert type
```

## Key Differences from Generic Drizzle

- **Bun-only**: Uses `drizzle-orm/bun-sql`, no `pg` or `postgres` drivers
- **Effect DI**: Database accessed via `yield* Database` Context.Tag, never imported directly in Application layer
- **Schema isolation**: Auth tables in `auth` schema, not `public`
- **Repository pattern**: All database access through Effect-wrapped repositories
- **Transaction type**: `DrizzleTransaction` exported for transaction callback parameters

## Full Documentation

- Official: https://orm.drizzle.team/
- LLM-optimized: https://orm.drizzle.team/llms.txt
- Bun SQL: https://bun.sh/docs/api/sql
