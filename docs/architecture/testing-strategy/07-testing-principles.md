# Testing Strategy - E2E-First TDD with Test-After Unit Tests

> **Note**: This is part 7 of the split documentation. See navigation links below.

## Testing Principles

### F.I.R.S.T Principles

The F.I.R.S.T principles ensure tests are reliable, maintainable, and valuable, regardless of when they're written (E2E first or unit after):

#### 1. Fast

**Unit Tests (Bun)**: Tests should execute in milliseconds

- ✅ Test pure functions without external dependencies
- ✅ Mock external services using dependency injection (databases, APIs, file system) — see [Part 16](./16-test-mocking-dependency-injection-over-mock-module.md)
- ✅ Run in parallel by default (Bun's built-in behavior)
- ✅ Use `bun test --watch` for instant feedback during development
- ❌ Avoid actual network calls, database queries, or file I/O
- ❌ Avoid `mock.module()` for application logic (causes cross-file contamination)
  **E2E Tests (Playwright)**: Tests should complete in seconds, not minutes
- ✅ Run tests in parallel across multiple workers
- ✅ Use network interception to mock slow API responses
- ✅ Focus on critical user paths (not exhaustive scenarios)
- ✅ Limit test scope to essential workflows
- ❌ Avoid testing every edge case in E2E (use unit tests instead)
  **Example - Fast Unit Test:**

```typescript
// ✅ GOOD - Fast (pure function, no I/O)
import { test, expect } from 'bun:test'
import { calculateTotal } from './calculator'
test('should calculate order total', () => {
  const result = calculateTotal([10, 20, 30])
  expect(result).toBe(60)
})
// ❌ BAD - Slow (makes actual API call)
test('should fetch user data', async () => {
  const user = await fetch('https://api.example.com/users/1').then((r) => r.json())
  expect(user.name).toBe('Alice')
})
```

**Example - Fast E2E Test:**

```typescript
// ✅ GOOD - Fast (mocks slow API)
import { test, expect } from '@playwright/test'
test('should display user profile', async ({ page }) => {
  await page.route('**/api/user', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    })
  })
  await page.goto('/profile')
  await expect(page.locator('h1')).toHaveText('Alice')
})
// ❌ BAD - Slow (waits for real API, multiple page loads)
test('should complete full checkout flow', async ({ page }) => {
  await page.goto('/products')
  await page.waitForTimeout(5000) // Arbitrary wait
  // ... multiple slow steps
})
```

#### 2. Isolated / Independent

**Unit Tests (Bun)**: Each test should be completely independent

- ✅ Use `beforeEach` for test setup (creates fresh state)
- ✅ Avoid shared mutable state between tests
- ✅ Clean up after tests (use `afterEach` for cleanup)
- ✅ Tests can run in any order without affecting each other
- ❌ Never rely on test execution order
  **E2E Tests (Playwright)**: Each test should run in isolation
- ✅ Use separate browser contexts for each test
- ✅ Clear cookies/storage before tests (`test.beforeEach`)
- ✅ Each test creates its own test data
- ✅ Tests don't depend on data from previous tests
- ❌ Never share state across tests
  **Example - Isolated Unit Tests:**

```typescript
import { test, expect, beforeEach } from 'bun:test'
// ✅ GOOD - Isolated (fresh state in beforeEach)
describe('Cart', () => {
  let cart: Cart
  beforeEach(() => {
    cart = new Cart() // Fresh cart for each test
  })
  test('should add item to cart', () => {
    cart.addItem({ id: 1, name: 'Widget', price: 10 })
    expect(cart.items).toHaveLength(1)
  })
  test('should calculate cart total', () => {
    cart.addItem({ id: 1, name: 'Widget', price: 10 })
    cart.addItem({ id: 2, name: 'Gadget', price: 20 })
    expect(cart.total()).toBe(30)
  })
})
// ❌ BAD - Not isolated (shared state)
let sharedCart = new Cart() // Shared across tests
test('should add item', () => {
  sharedCart.addItem({ id: 1, name: 'Widget', price: 10 })
  expect(sharedCart.items).toHaveLength(1) // Passes first time
})
test('should calculate total', () => {
  expect(sharedCart.items).toHaveLength(0) // Fails - cart has item from previous test!
})
```

**Example - Isolated E2E Tests:**

```typescript
import { test, expect } from '@playwright/test'
// ✅ GOOD - Isolated (each test creates its own user)
test('user can create account', async ({ page }) => {
  const uniqueEmail = `user-${Date.now()}@example.com`
  await page.goto('/register')
  await page.fill('[name="email"]', uniqueEmail)
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
test('user can login', async ({ page }) => {
  // Creates its own user, doesn't rely on previous test
  const uniqueEmail = `user-${Date.now()}@example.com`
  // Setup: Create user via API
  await page.request.post('/api/users', {
    data: { email: uniqueEmail, password: 'password123' },
  })
  await page.goto('/login')
  await page.fill('[name="email"]', uniqueEmail)
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
// ❌ BAD - Not isolated (depends on previous test)
const testUser = { email: 'test@example.com', password: 'password123' }
test('create user', async ({ page }) => {
  await page.goto('/register')
  await page.fill('[name="email"]', testUser.email)
  await page.fill('[name="password"]', testUser.password)
  await page.click('button[type="submit"]')
})
test('login user', async ({ page }) => {
  // Assumes user from previous test exists - will fail if tests run in different order
  await page.goto('/login')
  await page.fill('[name="email"]', testUser.email)
  await page.fill('[name="password"]', testUser.password)
  await page.click('button[type="submit"]')
})
```

#### 3. Repeatable

**Unit Tests (Bun)**: Same input always produces same output

- ✅ Use deterministic data (no random values, fixed dates)
- ✅ Mock time-dependent functions (`Date.now()`, `Math.random()`)
- ✅ Mock external dependencies with predictable responses
- ✅ Tests pass consistently in any environment
- ❌ Never rely on external services, system time, or random data
  **E2E Tests (Playwright)**: Tests produce consistent results
- ✅ Use deterministic test data (fixed users, products, dates)
- ✅ Mock time-sensitive operations (e.g., authentication tokens)
- ✅ Use `page.route()` to mock unreliable external APIs
- ✅ Handle timing issues with Playwright's auto-wait
- ❌ Never depend on real-time data or live APIs
  **Example - Repeatable Unit Test:**

```typescript
import { test, expect, mock, spyOn } from 'bun:test'
// ✅ GOOD - Repeatable (mocked Date with Bun's spyOn)
test('should generate expiration date 30 days from now', () => {
  const mockDate = new Date('2025-01-15T00:00:00Z')
  const dateSpy = spyOn(Date, 'now').mockReturnValue(mockDate.getTime())
  const result = generateExpirationDate()
  expect(result).toBe('2025-02-14T00:00:00Z')
  dateSpy.mockRestore() // Restore original Date.now
})
// ❌ BAD - Not repeatable (uses real time)
test('should generate expiration date', () => {
  const result = generateExpirationDate()
  // This assertion will fail tomorrow!
  expect(result).toBe('2025-02-15T00:00:00Z')
})
// ✅ GOOD - Repeatable (fixed random seed with Bun's spyOn)
test('should generate random ID', () => {
  const randomSpy = spyOn(Math, 'random').mockReturnValue(0.5)
  const result = generateId()
  expect(result).toBe('ID_50000')
  randomSpy.mockRestore() // Restore original Math.random
})
// ❌ BAD - Not repeatable (actual random)
test('should generate random ID', () => {
  const result = generateId()
  expect(result).toMatch(/ID_\d{5}/) // Weak assertion, hides randomness issue
})
```

**Example - Repeatable E2E Test:**

```typescript
import { test, expect } from '@playwright/test'
// ✅ GOOD - Repeatable (mocked API with fixed data)
test('should display product details', async ({ page }) => {
  await page.route('**/api/products/1', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        id: 1,
        name: 'Test Product',
        price: 29.99,
        stock: 10,
      }),
    })
  })
  await page.goto('/products/1')
  await expect(page.locator('h1')).toHaveText('Test Product')
  await expect(page.locator('.price')).toHaveText('$29.99')
})
// ❌ BAD - Not repeatable (depends on live API data)
test('should display latest products', async ({ page }) => {
  await page.goto('/products/latest')
  // Fails when API changes, product inventory fluctuates, or API is down
  await expect(page.locator('.product').first()).toHaveText('Widget 2000')
})
// ✅ GOOD - Repeatable (fixed date for time-sensitive data)
test('should display promotion banner', async ({ page, context }) => {
  // Mock system time to ensure promotion is active
  await context.addInitScript(() => {
    Date.now = () => new Date('2025-01-15T12:00:00Z').getTime()
  })
  await page.goto('/')
  await expect(page.locator('.promotion-banner')).toBeVisible()
  await expect(page.locator('.promotion-banner')).toHaveText('50% Off Sale - Limited Time!')
})
// ❌ BAD - Not repeatable (depends on actual date)
test('should display promotion banner', async ({ page }) => {
  await page.goto('/')
  // Passes during promotion, fails after promotion ends
  await expect(page.locator('.promotion-banner')).toBeVisible()
})
```

#### 4. Self-Validating

**Unit Tests (Bun)**: Tests determine pass/fail automatically

- ✅ Use explicit assertions (`expect().toBe()`, `expect().toThrow()`)
- ✅ Test produces boolean output (pass or fail)
- ✅ No manual inspection of logs or output required
- ✅ Clear error messages when tests fail
- ❌ Never require manual verification of results
  **E2E Tests (Playwright)**: Tests validate expected outcomes
- ✅ Use Playwright assertions (`expect(locator).toHaveText()`)
- ✅ Verify UI state changes automatically
- ✅ Check URLs, element visibility, text content
- ✅ No manual clicks or visual inspection needed
- ❌ Never rely on screenshots for validation (use assertions)
  **Example - Self-Validating Unit Test:**

```typescript
import { test, expect } from 'bun:test'
// ✅ GOOD - Self-validating (explicit assertions)
test('should validate email format', () => {
  const validEmail = 'user@example.com'
  const invalidEmail = 'invalid-email'
  expect(isValidEmail(validEmail)).toBe(true)
  expect(isValidEmail(invalidEmail)).toBe(false)
})
// ❌ BAD - Not self-validating (requires manual inspection)
test('should validate email format', () => {
  const result = isValidEmail('user@example.com')
  console.log('Validation result:', result) // Need to manually check console
})
// ✅ GOOD - Self-validating (tests error handling)
test('should throw error for invalid input', () => {
  expect(() => {
    processPayment({ amount: -100 })
  }).toThrow('Amount must be positive')
})
// ❌ BAD - Not self-validating (catches error but doesn't validate it)
test('should handle invalid input', () => {
  try {
    processPayment({ amount: -100 })
  } catch (error) {
    console.log('Error occurred:', error) // Manual inspection required
  }
})
```

**Example - Self-Validating E2E Test:**

```typescript
import { test, expect } from '@playwright/test'
// ✅ GOOD - Self-validating (assertions verify state)
test('should submit contact form', async ({ page }) => {
  await page.goto('/contact')
  await page.fill('[name="name"]', 'John Doe')
  await page.fill('[name="email"]', 'john@example.com')
  await page.fill('[name="message"]', 'Hello!')
  await page.click('button[type="submit"]')
  // Explicit assertions
  await expect(page.locator('.success-message')).toBeVisible()
  await expect(page.locator('.success-message')).toHaveText('Thank you for contacting us!')
  await expect(page).toHaveURL('/contact/success')
})
// ❌ BAD - Not self-validating (no assertions)
test('should submit contact form', async ({ page }) => {
  await page.goto('/contact')
  await page.fill('[name="name"]', 'John Doe')
  await page.fill('[name="email"]', 'john@example.com')
  await page.fill('[name="message"]', 'Hello!')
  await page.click('button[type="submit"]')
  // No assertions - requires manual verification
  await page.screenshot({ path: 'contact-form-result.png' })
})
// ✅ GOOD - Self-validating (validates multiple states)
test('should display validation errors', async ({ page }) => {
  await page.goto('/register')
  // Submit empty form
  await page.click('button[type="submit"]')
  // Assertions verify error state
  await expect(page.locator('.error-email')).toBeVisible()
  await expect(page.locator('.error-email')).toHaveText('Email is required')
  await expect(page.locator('.error-password')).toBeVisible()
  await expect(page.locator('.error-password')).toHaveText('Password is required')
  // Verify form not submitted
  await expect(page).toHaveURL('/register')
})
// ❌ BAD - Not self-validating (logs instead of assertions)
test('should display validation errors', async ({ page }) => {
  await page.goto('/register')
  await page.click('button[type="submit"]')
  const errorEmail = await page.locator('.error-email').textContent()
  const errorPassword = await page.locator('.error-password').textContent()
  console.log('Email error:', errorEmail) // Manual inspection required
  console.log('Password error:', errorPassword)
})
```

#### 5. Timely

**E2E Tests (Playwright)**: Write tests BEFORE implementing features (TDD)

- ✅ Write E2E tests FIRST as executable specifications
- ✅ E2E tests define feature completion criteria
- ✅ Implement feature until E2E test passes
- ✅ Tests prevent scope creep and over-engineering
- ❌ Never implement features without E2E tests first
  **Unit Tests (Bun)**: Write tests AFTER implementing features (Test-After)
- ✅ Write unit tests AFTER implementation is complete
- ✅ Unit tests document actual solution and implementation details
- ✅ Use `bun test --watch` for continuous feedback during refactoring
- ✅ Unit tests are part of definition of "done"
- ❌ Never skip unit tests after implementation
  **Example - Timely E2E Test (TDD - Written FIRST):**

```typescript
// Step 1: Write E2E test BEFORE implementation (Red)
import { test, expect } from '@playwright/test'
test('user can reset password', async ({ page }) => {
  // Given: User is on password reset page
  await page.goto('/reset-password')
  // When: User enters email and submits
  await page.fill('[name="email"]', 'user@example.com')
  await page.click('button[type="submit"]')
  // Then: Success message is displayed
  await expect(page.locator('.success')).toBeVisible()
  await expect(page.locator('.success')).toHaveText('Password reset email sent')
})
// Step 2: Implement feature until E2E passes
// - Create /reset-password route
// - Implement password reset logic
// - Add success message UI
// Step 3: Run E2E test - should pass (Green)
// Step 4: Add unit test coverage (see below)
```

**Example - Timely Unit Test (Test-After - Written AFTER implementation):**

```typescript
// Unit tests written AFTER feature implementation and E2E test passes
import { test, expect, describe } from 'bun:test'
import { sendPasswordResetEmail } from './password-reset'
import { validateEmail } from './validation'
describe('Password Reset', () => {
  // Unit test documents actual implementation details
  test('should validate email format before sending', () => {
    // Given: Invalid email
    const invalidEmail = 'not-an-email'
    // When: Email is validated
    const result = validateEmail(invalidEmail)
    // Then: Validation fails
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid email format')
  })
  test('should generate secure reset token', () => {
    // Given: Valid email
    const email = 'user@example.com'
    // When: Reset token is generated
    const token = generateResetToken(email)
    // Then: Token has correct format and length
    expect(token).toMatch(/^[A-Za-z0-9]{64}$/)
  })
  test('should set token expiration to 1 hour', () => {
    // Given: Current time mocked
    const mockDate = new Date('2025-01-15T12:00:00Z')
    const dateSpy = spyOn(Date, 'now').mockReturnValue(mockDate.getTime())
    // When: Token expiration is calculated
    const expiration = calculateTokenExpiration()
    // Then: Expiration is 1 hour from now
    expect(expiration).toBe('2025-01-15T13:00:00Z')
    dateSpy.mockRestore()
  })
})
// ✅ Unit tests written AFTER implementation to document solution
```

**Complete Development Flow Example:**

```typescript
// 1️⃣ E2E Test FIRST (TDD - defines "what" feature should do)
test('user can create table with validation rules', async ({ page }) => {
  await page.goto('/tables/new')
  await page.fill('[name="table-name"]', 'Customers')
  await page.click('button[aria-label="Add field"]')
  await page.fill('[name="field-name"]', 'Email')
  await page.selectOption('[name="field-type"]', 'email')
  await page.click('button[type="submit"]')
  await expect(page.locator('.success')).toHaveText('Table created successfully')
  await expect(page).toHaveURL('/tables/customers')
})
// 2️⃣ Implement feature until E2E passes
// src/domain/models/app/table.ts - Schema
// src/application/table-service.ts - Use case
// src/presentation/routes/tables.ts - API
// 3️⃣ Unit Tests AFTER (documents "how" implementation works)
describe('Table Schema Validation', () => {
  test('should validate table name is required', () => {
    const result = TableSchema.decode({ name: '' })
    expect(result.success).toBe(false)
  })
  test('should validate email field type', () => {
    const field = { name: 'Email', type: 'email' }
    const result = validateField(field)
    expect(result.success).toBe(true)
  })
})
```

### Given-When-Then Structure

The **Given-When-Then** pattern structures tests into three clear phases, applicable to both E2E and unit tests:

1. **Given** - Setup/preconditions (arrange)
2. **When** - Action/trigger (act)
3. **Then** - Expected outcome (assert)

#### Unit Test Example (Bun)

```typescript
import { test, expect, describe } from 'bun:test'
import { Cart } from './cart'
import { Product } from './product'
describe('Cart - Adding Products', () => {
  test('should add product to empty cart', () => {
    // Given: An empty cart and a product
    const cart = new Cart()
    const product = new Product({ id: 1, name: 'Widget', price: 10 })
    // When: Product is added to cart
    cart.addProduct(product)
    // Then: Cart contains the product
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toEqual(product)
    expect(cart.total()).toBe(10)
  })
  test('should increase quantity when adding same product twice', () => {
    // Given: A cart with one product already added
    const cart = new Cart()
    const product = new Product({ id: 1, name: 'Widget', price: 10 })
    cart.addProduct(product)
    // When: Same product is added again
    cart.addProduct(product)
    // Then: Quantity increases, total reflects both items
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].quantity).toBe(2)
    expect(cart.total()).toBe(20)
  })
  test('should handle adding multiple different products', () => {
    // Given: An empty cart and multiple products
    const cart = new Cart()
    const widget = new Product({ id: 1, name: 'Widget', price: 10 })
    const gadget = new Product({ id: 2, name: 'Gadget', price: 20 })
    // When: Multiple products are added
    cart.addProduct(widget)
    cart.addProduct(gadget)
    // Then: Cart contains all products with correct total
    expect(cart.items).toHaveLength(2)
    expect(cart.total()).toBe(30)
  })
})
```

#### E2E Test Example (Playwright)

```typescript
import { test, expect } from '@playwright/test'
test.describe('User Authentication', () => {
  test('user can log in with valid credentials', async ({ page }) => {
    // Given: User has valid credentials and is on login page
    const validEmail = 'user@example.com'
    const validPassword = 'password123'
    await page.goto('/login')
    // When: User enters credentials and submits form
    await page.fill('[name="email"]', validEmail)
    await page.fill('[name="password"]', validPassword)
    await page.click('button[type="submit"]')
    // Then: User is redirected to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toHaveText('Welcome back!')
  })
  test('user sees error with invalid credentials', async ({ page }) => {
    // Given: User is on login page
    await page.goto('/login')
    // When: User enters invalid credentials and submits
    await page.fill('[name="email"]', 'wrong@example.com')
    await page.fill('[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Then: Error message is displayed, user remains on login page
    await expect(page.locator('.error')).toBeVisible()
    await expect(page.locator('.error')).toHaveText('Invalid email or password')
    await expect(page).toHaveURL('/login')
  })
  test('user cannot submit form with empty fields', async ({ page }) => {
    // Given: User is on login page with empty form
    await page.goto('/login')
    // When: User attempts to submit without entering credentials
    await page.click('button[type="submit"]')
    // Then: Validation errors are displayed
    await expect(page.locator('.error-email')).toBeVisible()
    await expect(page.locator('.error-email')).toHaveText('Email is required')
    await expect(page.locator('.error-password')).toBeVisible()
    await expect(page.locator('.error-password')).toHaveText('Password is required')
    await expect(page).toHaveURL('/login')
  })
})
```

#### Effect Schema Validation Test Example

```typescript
import { test, expect, describe } from 'bun:test'
import { Schema } from 'effect'
const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: () => 'Invalid email format',
  })
)
describe('Email Schema Validation', () => {
  test('should accept valid email addresses', () => {
    // Given: Valid email addresses
    const validEmails = [
      'user@example.com',
      'test.user@company.co.uk',
      'info+newsletter@domain.org',
    ]
    // When: Each email is validated
    // Then: All emails pass validation
    validEmails.forEach((email) => {
      const result = Schema.decodeUnknownSync(EmailSchema)(email)
      expect(result).toBe(email)
    })
  })
  test('should reject invalid email addresses', () => {
    // Given: Invalid email addresses
    const invalidEmails = ['invalid-email', '@example.com', 'user@', 'user @example.com']
    // When: Each email is validated
    // Then: All emails fail validation with appropriate error
    invalidEmails.forEach((email) => {
      expect(() => {
        Schema.decodeUnknownSync(EmailSchema)(email)
      }).toThrow('Invalid email format')
    })
  })
  test('should reject non-string values', () => {
    // Given: Non-string values
    const invalidValues = [null, undefined, 123, true, { email: 'user@example.com' }]
    // When: Each value is validated
    // Then: All values fail validation
    invalidValues.forEach((value) => {
      expect(() => {
        Schema.decodeUnknownSync(EmailSchema)(value)
      }).toThrow()
    })
  })
})
```

### Combining F.I.R.S.T and Given-When-Then

Both principles work together to create high-quality tests, whether written first (E2E) or after (unit):

```typescript
import { test, expect } from 'bun:test'
test('should calculate shipping cost with discount', () => {
  // ✅ FAST: Pure function, no I/O
  // ✅ ISOLATED: No shared state
  // ✅ REPEATABLE: Fixed input values
  // ✅ SELF-VALIDATING: Explicit assertions
  // ✅ TIMELY: Written during feature development
  // Given: Order with specific weight and discount code
  const orderWeight = 5 // kg
  const discountCode = 'FREESHIP50'
  // When: Shipping cost is calculated
  const result = calculateShipping(orderWeight, discountCode)
  // Then: Cost reflects 50% discount
  expect(result).toBe(5.0) // Normal: $10, Discounted: $5
})
```

```typescript
import { test, expect } from '@playwright/test'
test('user can apply promo code during checkout', async ({ page }) => {
  // ✅ FAST: Mocks API responses, focused scope
  // ✅ ISOLATED: Creates own test data
  // ✅ REPEATABLE: Fixed promo code and products
  // ✅ SELF-VALIDATING: Assertions verify outcome
  // ✅ TIMELY: Written with checkout feature
  // Given: User has items in cart and valid promo code
  await page.route('**/api/cart', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ items: [{ name: 'Widget', price: 100 }], total: 100 }),
    })
  })
  await page.goto('/checkout')
  // When: User enters promo code and applies it
  await page.fill('[name="promo-code"]', 'SAVE20')
  await page.click('button[aria-label="Apply promo code"]')
  // Then: Discount is applied to total
  await expect(page.locator('.discount-amount')).toHaveText('-$20.00')
  await expect(page.locator('.order-total')).toHaveText('$80.00')
  await expect(page.locator('.success')).toHaveText('Promo code applied successfully')
})
```

---

## Navigation

[← Part 6](./06-test-file-naming-convention.md) | [Part 8 →](./08-playwright-best-practices.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | [Part 4](./04-managing-red-tests-with-fixme.md) | [Part 5](./05-quick-reference-when-to-write-tests.md) | [Part 6](./06-test-file-naming-convention.md) | **Part 7** | [Part 8](./08-playwright-best-practices.md) | [Part 9](./09-test-execution-strategies.md) | [Part 10](./10-best-practices-summary.md) | [Part 11](./11-anti-patterns-to-avoid.md) | [Part 12](./12-enforcement-and-code-review.md) | [Part 13](./13-references.md)
