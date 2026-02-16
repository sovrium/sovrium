# Test Mocking Strategy: Dependency Injection Over mock.module()

> **Note**: This is part 16 of the split documentation. See navigation links below.

## Overview

This document describes Sovrium's architectural decision to **use dependency injection (DI) for test mocking** instead of Bun's `mock.module()` for application-layer modules. This decision was made after discovering that `mock.module()` causes **process-global contamination** that leads to cross-file test failures in CI environments.

## The Problem: Process-Global Contamination

### Root Cause

Bun's `mock.module()` is **process-global** — it affects ALL test files in the process, not just the file that declares the mock. This causes:

1. **Cross-file contamination**: Mock declared in `file-a.test.ts` affects imports in `file-b.test.ts`
2. **Non-deterministic failures**: Test failures depend on file iteration order (different on Linux vs macOS)
3. **Local vs CI discrepancy**: Tests pass locally (macOS) but fail in CI (Linux) due to different iteration order
4. **Incomplete cleanup**: `mock.restore()` doesn't evict cached module evaluations

### Real-World Example: 24 CI Test Failures

**Scenario**: Authentication middleware tests in `src/presentation/api/routes/middleware/table.test.ts` used `mock.module()` to replace `getUserRole`:

```typescript
// table.test.ts
import { mock } from 'bun:test'

// ❌ DANGEROUS: This contaminates ALL other test files
mock.module('@/application/use-cases/tables/user-role', () => ({
  getUserRole: mock(async () => 'member'),
}))

test('enrichUserRole sets userRole for authenticated user', async () => {
  // Test passes in isolation
})
```

**Result**: 24 unrelated test files that imported `@/application/use-cases/tables/user-role` **started failing** because they received the mocked `'member'` response instead of the real implementation.

**Why local tests passed**: macOS file iteration loaded contaminated tests **after** dependent tests. Linux CI loaded them **before**, causing failures.

## The Architectural Decision

### Decision Statement

**Use dependency injection (optional function parameters or service objects) for test mocking instead of `mock.module()` for application-layer modules.**

### Rationale

| Criterion              | `mock.module()` (Global)                  | Dependency Injection (DI)           |
| ---------------------- | ----------------------------------------- | ----------------------------------- |
| **Scope**              | Process-global (contaminates all files)   | Function-scoped (isolated to test)  |
| **Type Safety**        | No type checking for mocked values        | Full TypeScript type checking       |
| **Side Effects**       | Yes — affects other test files            | No — mock only used in calling test |
| **Explicit Intent**    | Implicit (hidden import replacement)      | Explicit (parameter at call site)   |
| **Test Isolation**     | Broken (tests affect each other)          | Maintained (tests independent)      |
| **Debugging**          | Hard (non-local failures, file ordering)  | Easy (failures local to test)       |
| **Functional Purity**  | Violates (global mutable state)           | Preserves (explicit dependencies)   |
| **CI Reproducibility** | Poor (depends on file iteration order)    | Excellent (deterministic)           |
| **Exception**          | Database barrel (isolated, no dependents) | N/A (DI for everything else)        |

### Functional Programming Alignment

Dependency injection aligns with functional programming principles:

1. **Explicit dependencies**: Function signature declares what it needs
2. **Pure functions**: Default behavior deterministic, overridable for tests
3. **No hidden global state**: All dependencies visible at call site
4. **Referential transparency**: Same inputs always produce same outputs

## The Pattern: Dependency Injection for Mocking

### Pattern 1: Optional Function Parameter

**Production Code** (with default parameter):

```typescript
// src/application/use-cases/tables/user-role.ts
export async function getUserRole(userId: string): Promise<string> {
  // Real implementation using Effect DI
  const program = Effect.gen(function* () {
    const authService = yield* AuthService
    const role = yield* authService.getUserRole(userId)
    return role ?? DEFAULT_ROLE
  })
  return await Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
}

// src/presentation/api/routes/middleware/table.ts
export function enrichUserRole(
  // Optional function parameter for testing
  getUserRoleFn?: (userId: string) => Promise<string>
) {
  // Defaults to real function if not provided
  const resolveRole = getUserRoleFn ?? getUserRole

  return async (c: Context, next: Next) => {
    const session = c.get('session')
    const userRole = await resolveRole(session.userId)
    c.set('userRole', userRole)
    await next()
  }
}
```

**Test Code** (passes mock as parameter):

```typescript
// src/presentation/api/routes/middleware/table.test.ts
import { test, expect } from 'bun:test'
import { enrichUserRole } from './table'

test('enrichUserRole sets userRole for authenticated user', async () => {
  // ✅ SAFE: Mock passed as parameter (no global state)
  const mockGetUserRole = async () => 'member'
  const middleware = enrichUserRole(mockGetUserRole)

  // Given: Authenticated user with session
  const context = createMockContext({ userId: 'user-123' })

  // When: Middleware is executed
  await middleware(context, async () => {})

  // Then: userRole is set to 'member'
  expect(context.get('userRole')).toBe('member')
})
```

**Benefits**:

- ✅ No `mock.module()` needed
- ✅ Test-specific mock doesn't affect other files
- ✅ Type-safe (TypeScript validates mock signature)
- ✅ Explicit at call site (clear what's being mocked)
- ✅ Deterministic (same on macOS and Linux)

### Pattern 2: Optional Service Object

**Production Code** (with optional service parameter):

```typescript
// src/application/use-cases/tables/user-role.ts
export type AuthRoleService = {
  readonly getUserRole: (userId: string) => Promise<string | undefined>
}

export async function getUserRole(
  userId: string,
  service?: AuthRoleService // Optional for testing
): Promise<string> {
  if (service) {
    // Test path: Use provided service
    const role = await service.getUserRole(userId)
    return role ?? DEFAULT_ROLE
  }

  // Production path: Use Effect DI
  const program = Effect.gen(function* () {
    const authService = yield* AuthService
    const role = yield* authService.getUserRole(userId)
    return role ?? DEFAULT_ROLE
  })
  return await Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
}
```

**Test Code** (passes mock service object):

```typescript
// src/application/use-cases/tables/user-role.test.ts
import { test, expect } from 'bun:test'
import { getUserRole, type AuthRoleService } from './user-role'

test('getUserRole returns role from service', async () => {
  // ✅ SAFE: Mock service passed as parameter
  const mockService: AuthRoleService = {
    getUserRole: async () => 'admin',
  }

  // When: getUserRole called with mock service
  const role = await getUserRole('user-123', mockService)

  // Then: Role from mock service is returned
  expect(role).toBe('admin')
})

test('getUserRole returns default role when service returns undefined', async () => {
  // Given: Service returns undefined
  const mockService: AuthRoleService = {
    getUserRole: async () => undefined,
  }

  // When: getUserRole called with mock service
  const role = await getUserRole('user-123', mockService)

  // Then: Default role is returned
  expect(role).toBe('viewer') // DEFAULT_ROLE
})
```

**Benefits**:

- ✅ Full service interface control
- ✅ Can mock multiple methods
- ✅ Type-safe (implements interface)
- ✅ Clear separation of test vs production paths

## The Exception: Database Barrel Mock

### Why Database Mock is Allowed

`mock.module('@/infrastructure/database', ...)` is the **ONLY acceptable `mock.module()` usage** because:

1. **Isolated dependency**: Only provides `db`, error classes, and transaction helpers
2. **No re-export risk**: No other test file depends on re-importing specific shapes from the barrel
3. **Required for testing**: Can't hit real database in unit tests
4. **Stable interface**: Database connection shape rarely changes

**Allowed pattern**:

```typescript
// src/application/use-cases/**/*.test.ts
import { mock } from 'bun:test'

// ✅ SAFE: Database barrel is the only allowed mock.module usage
mock.module('@/infrastructure/database', () => ({
  db: mockDb,
  DatabaseError: class extends Error {},
  transaction: mockTransaction,
}))
```

**Why this doesn't contaminate**:

- Other test files that import `@/infrastructure/database` get the same mock (expected)
- No test file depends on specific database query results (all use repository abstractions)
- Mock provides complete database interface (no partial replacements)

## Migration Guide: From mock.module() to DI

### Step 1: Identify mock.module() Usage

```bash
# Find all mock.module calls in application layer
grep -r "mock.module" src/application src/presentation
```

### Step 2: Add Optional Parameter to Function

**Before**:

```typescript
// ❌ No DI parameter
export async function processUserAction(userId: string) {
  const role = await getUserRole(userId)
  return role
}
```

**After**:

```typescript
// ✅ Optional DI parameter with default
export async function processUserAction(
  userId: string,
  getUserRoleFn?: (userId: string) => Promise<string> // Added
) {
  const resolveRole = getUserRoleFn ?? getUserRole // Added
  const role = await resolveRole(userId) // Changed
  return role
}
```

### Step 3: Update Tests to Use DI

**Before**:

```typescript
// ❌ Global mock
import { mock } from 'bun:test'
mock.module('@/application/use-cases/tables/user-role', () => ({
  getUserRole: mock(async () => 'admin'),
}))

test('processUserAction works for admin', async () => {
  const result = await processUserAction('user-123')
  expect(result).toBe('admin')
})
```

**After**:

```typescript
// ✅ DI parameter
import { test, expect } from 'bun:test'
import { processUserAction } from './process-user-action'

test('processUserAction works for admin', async () => {
  // Mock passed as parameter
  const mockGetUserRole = async () => 'admin'
  const result = await processUserAction('user-123', mockGetUserRole)
  expect(result).toBe('admin')
})
```

### Step 4: Remove mock.module() Call

```typescript
// ❌ DELETE THIS
mock.module('@/application/use-cases/tables/user-role', () => ({
  getUserRole: mock(async () => 'admin'),
}))
```

### Step 5: Verify All Tests Pass

```bash
# Run all unit tests
bun test

# Verify no cross-file contamination
bun test --rerun-each 3  # Run tests 3 times with different orders
```

## Enforcement Mechanism

### Manual Review (Current)

**Code review checklist**:

- [ ] No `mock.module()` calls in application/presentation tests (except database barrel)
- [ ] Functions with test mocks have optional DI parameters
- [ ] Test mocks passed as explicit parameters (not global state)
- [ ] Mock signatures match production function signatures (type-safe)

### Proposed ESLint Rule (Future)

ESLint rule to restrict `mock.module()` usage:

```typescript
// eslint.config.ts
{
  files: ['src/application/**/*.test.ts', 'src/presentation/**/*.test.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.object.name="mock"][callee.property.name="module"]',
        message:
          'Do not use mock.module() in application/presentation tests. Use dependency injection (optional function parameters) for test mocking. See docs/architecture/testing-strategy/16-test-mocking-dependency-injection-over-mock-module.md',
      },
    ],
  },
}
```

**Exception for database barrel**:

```typescript
{
  files: ['src/**/*.test.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'CallExpression[callee.object.name="mock"][callee.property.name="module"][arguments.0.value!="@/infrastructure/database"]',
        message:
          'mock.module() is only allowed for @/infrastructure/database. Use dependency injection for other mocks.',
      },
    ],
  },
}
```

## Best Practices

### ✅ DO: Use Optional Parameters for DI

```typescript
// Production function with optional mock parameter
export function createUser(
  userData: UserData,
  hashPasswordFn?: (password: string) => Promise<string>
) {
  const hashFn = hashPasswordFn ?? bcrypt.hash
  const hashedPassword = await hashFn(userData.password)
  return { ...userData, password: hashedPassword }
}

// Test with mock
test('createUser hashes password', async () => {
  const mockHash = async (pw: string) => `hashed_${pw}`
  const user = await createUser({ password: 'secret123' }, mockHash)
  expect(user.password).toBe('hashed_secret123')
})
```

### ✅ DO: Default to Production Implementation

```typescript
// Always provide default (production) implementation
export function processPayment(
  amount: number,
  paymentGatewayFn?: (amount: number) => Promise<string>
) {
  const gateway = paymentGatewayFn ?? stripePaymentGateway
  return gateway(amount)
}
```

### ✅ DO: Use Type Definitions for Service Objects

```typescript
// Define service interface
export type PaymentService = {
  readonly processPayment: (amount: number) => Promise<string>
  readonly refund: (transactionId: string) => Promise<void>
}

// Production function with optional service
export async function handlePayment(amount: number, service?: PaymentService): Promise<string> {
  if (service) return service.processPayment(amount)
  // Production path
  return await defaultPaymentService.processPayment(amount)
}

// Test with mock service
test('handlePayment processes via service', async () => {
  const mockService: PaymentService = {
    processPayment: async (amt) => `charged_${amt}`,
    refund: async () => {},
  }
  const result = await handlePayment(100, mockService)
  expect(result).toBe('charged_100')
})
```

### ❌ DON'T: Use mock.module() for Application Logic

```typescript
// ❌ BAD: Process-global contamination
import { mock } from 'bun:test'
mock.module('@/application/services/email', () => ({
  sendEmail: mock(async () => true),
}))

// This mock affects ALL tests that import email service!
```

### ❌ DON'T: Forget to Restore Defaults

```typescript
// ❌ BAD: No default fallback
export function fetchUser(userId: string, fetchFn?: (id: string) => Promise<User>) {
  return fetchFn(userId) // Crashes if fetchFn is undefined!
}

// ✅ GOOD: Default fallback
export function fetchUser(userId: string, fetchFn?: (id: string) => Promise<User>) {
  const fetch = fetchFn ?? defaultFetchUser
  return fetch(userId)
}
```

## Common Pitfalls

### Pitfall 1: Forgetting to Pass Mock in Test

**Problem**:

```typescript
export function processOrder(orderId: string, notifyFn?: () => Promise<void>) {
  const notify = notifyFn ?? sendEmailNotification
  await notify()
}

test('processOrder sends notification', async () => {
  // ❌ Forgot to pass mock — uses real email service!
  await processOrder('order-123')
  // This test sends a real email!
})
```

**Solution**:

```typescript
test('processOrder sends notification', async () => {
  // ✅ Pass mock to prevent real email
  const mockNotify = async () => {}
  await processOrder('order-123', mockNotify)
})
```

### Pitfall 2: Mocking at Wrong Layer

**Problem**:

```typescript
// ❌ Adding DI parameter to domain function (violates purity)
export function calculateTax(amount: number, taxRateFn?: () => number) {
  const rate = taxRateFn ?? getTaxRate
  return amount * rate()
}
```

**Solution**:

```typescript
// ✅ Domain function remains pure
export function calculateTax(amount: number, taxRate: number) {
  return amount * taxRate
}

// ✅ Application layer handles retrieval (with DI for tests)
export async function calculateOrderTax(orderId: string, getTaxRateFn?: () => Promise<number>) {
  const getTaxRate = getTaxRateFn ?? fetchTaxRate
  const order = await getOrder(orderId)
  const taxRate = await getTaxRate()
  return calculateTax(order.amount, taxRate)
}
```

### Pitfall 3: Type Mismatch Between Mock and Real Function

**Problem**:

```typescript
// Real function returns Promise<User>
export async function getUser(id: string): Promise<User> {
  // ...
}

// ❌ Mock returns User (not Promise<User>)
test('something', async () => {
  const mockGetUser = (id: string) => ({ id, name: 'Test' }) // Wrong return type!
  await processUser('user-123', mockGetUser)
})
```

**Solution**:

```typescript
// ✅ Mock matches real function signature
test('something', async () => {
  const mockGetUser = async (id: string): Promise<User> => ({ id, name: 'Test' })
  await processUser('user-123', mockGetUser)
})
```

## Related Patterns

### Repository Pattern with Effect DI

The DI pattern complements Effect's Context-based dependency injection:

```typescript
// Domain repository interface
export class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findById: (id: string) => Effect.Effect<User, UserNotFoundError>
  }
>() {}

// Application use case with Effect DI
export const GetUser = (userId: string) =>
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    const user = yield* userRepo.findById(userId)
    return user
  })

// Test with mock Layer
const MockUserRepository = Layer.succeed(UserRepository, {
  findById: (id) => Effect.succeed({ id, name: 'Mock User' }),
})

test('GetUser fetches user', async () => {
  const program = GetUser('user-123').pipe(Effect.provide(MockUserRepository))
  const user = await Effect.runPromise(program)
  expect(user.name).toBe('Mock User')
})
```

**Key difference**: Effect DI uses Layers (provided at runtime), while function parameter DI uses optional parameters (provided at call site).

### Middleware Factory Pattern

Middleware functions often use the DI pattern for testing:

```typescript
// Middleware factory with optional dependencies
export function createAuthMiddleware(validateTokenFn?: (token: string) => Promise<boolean>) {
  const validateToken = validateTokenFn ?? jwtValidate

  return async (c: Context, next: Next) => {
    const token = c.req.header('Authorization')
    const isValid = await validateToken(token)
    if (!isValid) return c.json({ error: 'Unauthorized' }, 401)
    await next()
  }
}

// Test with mock validator
test('createAuthMiddleware rejects invalid token', async () => {
  const mockValidate = async () => false
  const middleware = createAuthMiddleware(mockValidate)
  // Test middleware...
})
```

## Summary

| Aspect                     | Recommendation                                                            |
| -------------------------- | ------------------------------------------------------------------------- |
| **Application Layer**      | Use DI (optional function parameters)                                     |
| **Domain Layer**           | Keep pure (no DI parameters needed)                                       |
| **Infrastructure Layer**   | Use Effect Layers for DI                                                  |
| **Presentation Layer**     | Use DI for middleware/route dependencies                                  |
| **Database Mocking**       | `mock.module('@/infrastructure/database', ...)` is allowed                |
| **Other mock.module()**    | **Forbidden** — use DI instead                                            |
| **Enforcement**            | Manual code review (ESLint rule proposed for future)                      |
| **Functional Programming** | DI aligns with explicit dependencies and referential transparency         |
| **CI Reliability**         | DI eliminates process-global contamination and non-deterministic failures |

By following this pattern, Sovrium maintains **test isolation**, **type safety**, and **CI reliability** while adhering to functional programming principles of explicit dependencies and pure functions.

---

## Navigation

[← Part 15](./15-authentication-testing-strategy.md) | [Part 13 →](./13-references.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | [Part 4](./04-managing-red-tests-with-fixme.md) | [Part 5](./05-quick-reference-when-to-write-tests.md) | [Part 6](./06-test-file-naming-convention.md) | [Part 7](./07-testing-principles.md) | [Part 8](./08-playwright-best-practices.md) | [Part 9](./09-test-execution-strategies.md) | [Part 10](./10-best-practices-summary.md) | [Part 11](./11-anti-patterns-to-avoid.md) | [Part 12](./12-enforcement-and-code-review.md) | [Part 13](./13-references.md) | **Part 16**
