# Testing Strategy - E2E-First TDD with Test-After Unit Tests

> **Note**: This is part 4 of the split documentation. See navigation links below.

## Managing Red Tests with `.fixme`

When writing E2E tests BEFORE implementation (RED phase of TDD), use Playwright's `.fixme` modifier to mark tests as known failures. This allows the test suite to pass in CI while documenting unimplemented features.

### Why Use `.fixme`?

- ✅ **CI stays green**: Tests don't fail the build while features are in development
- ✅ **Documents intent**: Clearly shows which features are planned but not yet implemented
- ✅ **Tracks progress**: Easy to see what needs to be done
- ✅ **Prevents forgetting**: Tests are written and committed, just marked as incomplete

### Usage Pattern

**Step 1: Write RED test with `.fixme`**

```typescript
import { test, expect } from '@playwright/test'
// Mark as fixme during RED phase
test.fixme('should display version badge when app has version', async ({ page }) => {
  // Given: An app with version
  await page.goto('/')
  // When: Page loads
  // Then: Version badge should be visible
  await expect(page.locator('[data-testid="app-version-badge"]')).toBeVisible()
  await expect(page.locator('[data-testid="app-version-badge"]')).toHaveText('1.0.0')
})
```

**Step 2: Implement feature (GREEN phase)**

```typescript
// src/presentation/components/DefaultHomePage.tsx
export function DefaultHomePage({ app }: { readonly app: App }) {
  return (
    <html>
      {/* ... */}
      {app.version && (
        <Badge data-testid="app-version-badge">{app.version}</Badge>
      )}
    </html>
  )
}
```

**Step 3: Remove `.fixme` when implementation is complete**

```typescript
// Remove .fixme - test should now pass
test('should display version badge when app has version', async ({ page }) => {
  // Given: An app with version
  await page.goto('/')
  // When: Page loads
  // Then: Version badge should be visible
  await expect(page.locator('[data-testid="app-version-badge"]')).toBeVisible()
  await expect(page.locator('[data-testid="app-version-badge"]')).toHaveText('1.0.0')
})
```

### `.fixme` vs `.skip`

| Modifier     | Purpose                    | When to Use                                                  |
| ------------ | -------------------------- | ------------------------------------------------------------ |
| **`.fixme`** | Known failure, planned fix | RED tests during TDD - feature not yet implemented           |
| **`.skip`**  | Temporarily disabled       | Flaky tests, environment-specific issues, temporary problems |

**Example:**

```typescript
// ✅ GOOD - Use .fixme for unimplemented features (TDD RED phase)
test.fixme('should send email notification on user signup', async ({ page }) => {
  // Test defines feature completion criteria
  // Implementation coming soon
})
// ✅ GOOD - Use .skip for temporarily broken tests
test.skip('should handle edge case X', async ({ page }) => {
  // Known issue #123 - will fix when library updates
})
// ❌ BAD - Don't commit .skip for unimplemented features
test.skip('should display user profile', async ({ page }) => {
  // This should be .fixme instead
})
```

### Best Practices

1. **Always add a comment** explaining why `.fixme` is used:
   ```typescript
   // FIXME: Implement version badge display (see: specs/app/version.spec.ts)
   test.fixme('should display version badge', async ({ page }) => {
     // ...
   })
   ```
2. **Link to related issue or task:**
   ```typescript
   // FIXME: #456 - Add version badge to DefaultHomePage
   test.fixme('should display version badge', async ({ page }) => {
     // ...
   })
   ```
3. **Remove `.fixme` as soon as implementation is done:**
   - Don't let `.fixme` tests accumulate
   - Remove during GREEN phase of TDD cycle
   - Verify test passes before removing modifier
4. **Track `.fixme` tests in reviews:**
   - Code reviews should check for new `.fixme` tests
   - Ensure there's a plan to implement the feature
   - Don't let `.fixme` tests become permanent

### Playwright Test Status

When using `.fixme`, Playwright reports the test status as:

```
✓ should display version badge [fixme]
```

## This indicates the test exists but is intentionally skipped due to missing implementation.

## Navigation

[← Part 3](./03-testing-approach.md) | [Part 5 →](./05-quick-reference-when-to-write-tests.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | **Part 4** | [Part 5](./05-quick-reference-when-to-write-tests.md) | [Part 6](./06-test-file-naming-convention.md) | [Part 7](./07-testing-principles.md) | [Part 8](./08-playwright-best-practices.md) | [Part 9](./09-test-execution-strategies.md) | [Part 10](./10-best-practices-summary.md) | [Part 11](./11-anti-patterns-to-avoid.md) | [Part 12](./12-enforcement-and-code-review.md) | [Part 13](./13-references.md)
