# Drizzle ORM - Type-Safe SQL Database Toolkit

> **Note**: This is part 5 of the split documentation. See navigation links below.

## Integration with Sovrium Stack

### TypeScript (^5)

Drizzle leverages TypeScript's type system for full type safety:

```typescript
import { pgTable, integer, text } from 'drizzle-orm/pg-core'
// Schema definition generates TypeScript types
export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
})
// Infer types from schema
export type User = typeof users.$inferSelect // { id: number; name: string; email: string }
export type NewUser = typeof users.$inferInsert // { name: string; email: string; id?: number }
```

### Effect.ts (3.19.8)

Drizzle operations integrate seamlessly with Effect using Bun SQL:

```typescript
import { Effect, Context, Layer } from 'effect'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
// Define Database service
class Database extends Context.Tag('Database')<Database, ReturnType<typeof drizzle>>() {}
// Database layer with Bun SQL
const DatabaseLive = Layer.sync(Database, () => {
  const client = new SQL({
    url: process.env.DATABASE_URL!,
    max: 20,
  })
  return drizzle({ client })
})
// Database operations as Effect programs
const findUserById = (id: number): Effect.Effect<User, UserNotFoundError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database
    const result = yield* Effect.tryPromise({
      try: () => db.select().from(users).where(eq(users.id, id)).get(),
      catch: (error) => new DatabaseError({ cause: error }),
    })
    if (!result) {
      return yield* Effect.fail(new UserNotFoundError({ userId: id }))
    }
    return result
  })
```

### Better Auth (drizzleAdapter)

Drizzle provides a native adapter for Better Auth:

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite', // or 'pg' for PostgreSQL
  }),
  // ... other Better Auth configuration
})
```

### Layer-Based Architecture (Infrastructure Layer)

Drizzle fits in the Infrastructure Layer:

```
┌─────────────────────────────────────┐
│      Presentation Layer             │
│  (Hono routes, React components)    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Application Layer              │
│  (Business logic, use cases)        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Domain Layer                   │
│  (Entities, value objects)          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Infrastructure Layer           │
│  (Drizzle ORM, repositories)        │  ← Drizzle lives here
└─────────────────────────────────────┘
```

---

## Navigation

[← Part 4](./04-installation.md) | [Part 6 →](./06-database-setup.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-drizzle-orm-for-sovrium.md) | [Part 4](./04-installation.md) | **Part 5** | [Part 6](./06-database-setup.md) | [Part 7](./07-schema-definition.md) | [Part 8](./08-query-api.md) | [Part 9](./09-transactions.md) | [Part 10](./10-effect-integration-patterns.md) | [Part 11](./11-migrations-with-drizzle-kit.md) | [Part 12](./12-best-practices.md) | [Part 13](./13-common-patterns.md) | [Part 14](./14-integration-with-better-auth-postgresql.md) | [Part 15](./15-performance-considerations.md) | [Part 16](./16-common-pitfalls-to-avoid.md) | [Part 17](./17-drizzle-studio.md) | [Part 18](./18-postgresql-best-practices-for-sovrium.md) | [Part 19](./19-references.md) | [Part 20](./20-summary.md)
