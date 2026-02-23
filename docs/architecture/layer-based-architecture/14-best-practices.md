# Layer-Based Architecture in Sovrium

> **Note**: This is part 14 of the split documentation. See navigation links below.

## Best Practices

### 1. Respect Dependency Direction

```typescript
// ✅ CORRECT: Outer layers depend on inner layers
import { User } from '@/domain/models/User' // Presentation → Domain
import { GetUserProfile } from '@/application/use-cases/GetUserProfile' // Presentation → Application
import { UserRepository } from '@/application/ports/UserRepository' // Application → Application Port
// ❌ INCORRECT: Inner layers depending on outer layers
import { UserProfile } from '@/presentation/ui/UserProfile' // Domain → Presentation (NEVER!)
```

### 2. Keep Domain Layer Pure

```typescript
// ✅ CORRECT: Pure domain function
export function calculateTotal(items: readonly OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
// ❌ INCORRECT: Domain function with side effects
export function calculateTotalAndLog(items: OrderItem[]): number {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  console.log(`Total: ${total}`) // Side effect!
  return total
}
```

### 3. Use Interfaces for Infrastructure

```typescript
// ✅ CORRECT: Application Layer defines interface
export class EmailService extends Context.Tag('EmailService')<
  EmailService,
  {
    readonly send: (email: Email) => Effect.Effect<void, EmailError>
  }
>() {}
// Infrastructure Layer implements interface
export const EmailServiceLive = Layer.succeed(EmailService, {
  send: (email) => Effect.promise(() => sendgrid.send(email)),
})
// ❌ INCORRECT: Application Layer depends on concrete implementation
import { sendEmail } from '@/infrastructure/email/sendgrid' // Direct dependency on infrastructure!
```

### 4. Single Responsibility per Layer

```typescript
// ✅ CORRECT: Presentation handles UI, Application handles workflow
function UserProfile({ userId }) {
  const program = GetUserProfile({ userId })
  // UI rendering logic only
}
export const GetUserProfile = (input) =>
  Effect.gen(function* () {
    // Workflow orchestration only
    const user = yield* userRepo.findById(input.userId)
    return user
  })
// ❌ INCORRECT: Mixing UI and workflow logic
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    // Workflow logic in component (should be in Application Layer)
    database.query(`SELECT * FROM users WHERE id = ${userId}`).then(setUser)
  }, [userId])
  return <div>{user?.name}</div>
}
```

---

## Navigation

[← Part 13](./13-file-structure.md) | [Part 15 →](./15-common-pitfalls.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-what-is-layer-based-architecture.md) | [Part 4](./04-why-layer-based-architecture-for-sovrium.md) | [Part 5](./05-sovriums-four-layers.md) | [Part 6](./06-layer-1-presentation-layer-uiapi.md) | [Part 7](./07-layer-2-application-layer-use-casesorchestration.md) | [Part 8](./08-layer-3-domain-layer-business-logic.md) | [Part 9](./09-layer-4-infrastructure-layer-external-services.md) | [Part 10](./10-layer-communication-patterns.md) | [Part 11](./11-integration-with-functional-programming.md) | [Part 12](./12-testing-layer-based-architecture.md) | [Part 13](./13-file-structure.md) | **Part 14** | [Part 15](./15-common-pitfalls.md) | [Part 16](./16-resources-and-references.md) | [Part 17](./17-summary.md)
