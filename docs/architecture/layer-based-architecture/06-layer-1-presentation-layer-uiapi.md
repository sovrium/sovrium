# Layer-Based Architecture in Sovrium

> **Note**: This is part 6 of the split documentation. See navigation links below.

## Layer 1: Presentation Layer (UI/API)

### Responsibility

Handle user interactions, render UI, route HTTP requests, and present data to users.

### Technologies

- **React 19** - UI components, user interactions
- **Hono** - HTTP routing, API endpoints
- **Tailwind CSS** - Component styling

### What Belongs Here

- React components (presentational and container)
- Hono route handlers (API endpoints)
- HTTP request/response formatting
- Input validation (basic format checks)
- UI state management (component-level)
- Route parameter extraction
- Error presentation (error pages, alerts)
- Form handling and submission

### What Does NOT Belong Here

- ❌ Business logic and calculations
- ❌ Database queries or operations
- ❌ Complex validation rules (domain responsibility)
- ❌ Data transformation logic
- ❌ External API calls (infrastructure responsibility)

### Communication Pattern

- **Inbound**: User input, HTTP requests
- **Outbound**: Calls Application Layer use cases
- **Dependencies**: Application Layer interfaces

### Code Examples

#### React Component (Presentation Layer)

```typescript
// src/presentation/ui/UserProfile.tsx
import { useState, useEffect } from 'react'
import { Effect } from 'effect'
import type { User } from '@/domain/models/User'
import { GetUserProfile } from '@/application/use-cases/GetUserProfile'
import { AppLayer } from '@/infrastructure/layers/AppLayer'
// ✅ CORRECT: Presentation component delegates to Application Layer
interface UserProfileProps {
  readonly userId: number
}
export function UserProfile({ userId }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    // Call Application Layer use case
    const program = GetUserProfile({ userId }).pipe(
      Effect.provide(AppLayer)
    )
    Effect.runPromise(program)
      .then((user) => {
        setUser(user)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [userId])
  if (loading) return <div className="text-gray-500">Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!user) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{user.name}</h1>
      <p className="text-gray-600">{user.email}</p>
      <p className="mt-2 text-sm text-gray-500">
        Member since {user.joinedAt.toLocaleDateString()}
      </p>
    </div>
  )
}
```

#### Hono Route Handler (Presentation Layer)

```typescript
// src/presentation/api/users.ts
import { Hono } from 'hono'
import { Effect } from 'effect'
import { GetUserProfile } from '@/application/use-cases/GetUserProfile'
import { UpdateUserEmail } from '@/application/use-cases/UpdateUserEmail'
import { AppLayer } from '@/infrastructure/layers/AppLayer'
const app = new Hono()
// ✅ CORRECT: Route handler delegates to Application Layer
app.get('/users/:id', async (c) => {
  const userId = Number(c.req.param('id'))
  // Validate input format (presentation responsibility)
  if (isNaN(userId) || userId <= 0) {
    return c.json({ error: 'Invalid user ID' }, 400)
  }
  // Call Application Layer use case
  const program = GetUserProfile({ userId }).pipe(Effect.provide(AppLayer))
  const result = await Effect.runPromise(program.pipe(Effect.either))
  if (result._tag === 'Left') {
    const error = result.left
    if (error._tag === 'UserNotFoundError') {
      return c.json({ error: 'User not found' }, 404)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
  const user = result.right
  return c.json({
    id: user.id,
    name: user.name,
    email: user.email,
    joinedAt: user.joinedAt.toISOString(),
  })
})
app.patch('/users/:id/email', async (c) => {
  const userId = Number(c.req.param('id'))
  const body = await c.req.json()
  // Basic format validation (presentation responsibility)
  if (!body.email || typeof body.email !== 'string') {
    return c.json({ error: 'Email is required' }, 400)
  }
  // Call Application Layer use case (includes domain validation)
  const program = UpdateUserEmail({ userId, newEmail: body.email }).pipe(Effect.provide(AppLayer))
  const result = await Effect.runPromise(program.pipe(Effect.either))
  if (result._tag === 'Left') {
    const error = result.left
    if (error._tag === 'InvalidEmailError') {
      return c.json({ error: error.message }, 400)
    }
    if (error._tag === 'UserNotFoundError') {
      return c.json({ error: 'User not found' }, 404)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
  return c.json({ success: true })
})
export default app
```

### Do's and Don'ts

#### ✅ DO

1. **Delegate business logic** to Application Layer use cases
2. **Handle presentation concerns** (routing, rendering, styling)
3. **Validate input format** (basic checks like type, presence)
4. **Transform data for display** (formatting dates, currencies)
5. **Manage UI state** (loading, error, form input)
6. **Map errors to user-friendly messages** (presentation responsibility)

#### ❌ DON'T

1. **Implement business rules** (belongs in Domain Layer)
2. **Access databases directly** (use Application Layer)
3. **Perform complex calculations** (belongs in Domain Layer)
4. **Make external API calls** (use Application Layer)
5. **Mix presentation and business logic** (separate concerns)

---

## Navigation

[← Part 5](./05-sovriums-four-layers.md) | [Part 7 →](./07-layer-2-application-layer-use-casesorchestration.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-what-is-layer-based-architecture.md) | [Part 4](./04-why-layer-based-architecture-for-sovrium.md) | [Part 5](./05-sovriums-four-layers.md) | **Part 6** | [Part 7](./07-layer-2-application-layer-use-casesorchestration.md) | [Part 8](./08-layer-3-domain-layer-business-logic.md) | [Part 9](./09-layer-4-infrastructure-layer-external-services.md) | [Part 10](./10-layer-communication-patterns.md) | [Part 11](./11-integration-with-functional-programming.md) | [Part 12](./12-testing-layer-based-architecture.md) | [Part 13](./13-file-structure.md) | [Part 14](./14-best-practices.md) | [Part 15](./15-common-pitfalls.md) | [Part 16](./16-resources-and-references.md) | [Part 17](./17-summary.md)
