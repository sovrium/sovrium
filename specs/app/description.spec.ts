/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for App Description
 *
 * Source: src/domain/models/app/description.ts
 * Specs: APP-DESCRIPTION-001 through APP-DESCRIPTION-015
 *
 * Test Organization:
 * 1. @spec tests - 15 granular specification tests (one per spec in schema)
 * 2. @regression test - ONE consolidated workflow test
 */

// ============================================================================
// SPECIFICATION TESTS (@spec)
// Granular tests defining acceptance criteria during TDD development
// Run during: Development, pre-commit (bun test:e2e:spec)
// ============================================================================

test(
  'APP-DESCRIPTION-001: should display description below app name',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with name and description
    // Spec: APP-DESCRIPTION-001
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'A simple application',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description is visible below the app name
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeVisible()
    await expect(description).toHaveText('A simple application')
  }
)

test(
  'APP-DESCRIPTION-002: should NOT render description element when description property is missing',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with only name (no description property)
    // Spec: APP-DESCRIPTION-002
    await startServerWithSchema(
      {
        name: 'test-app',
        // description: undefined (omitted)
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description element is NOT rendered
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeHidden()
  }
)

test(
  'APP-DESCRIPTION-003: should render description AFTER h1 title in DOM order',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with name and description
    // Spec: APP-DESCRIPTION-003
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'A simple application',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description appears AFTER the h1 title in DOM order
    const title = page.locator('h1[data-testid="app-name-heading"]')
    const description = page.locator('[data-testid="app-description"]')

    // THEN: assertion
    await expect(title).toBeVisible()
    await expect(description).toBeVisible()

    // Verify DOM order: title comes before description
    const titleBox = await title.boundingBox()
    const descriptionBox = await description.boundingBox()

    // THEN: assertion
    expect(titleBox).not.toBeNull()
    expect(descriptionBox).not.toBeNull()
    expect(titleBox!.y).toBeLessThan(descriptionBox!.y)
  }
)

test(
  'APP-DESCRIPTION-004: should display special characters correctly',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with description containing special characters
    // Spec: APP-DESCRIPTION-004
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'My app - with special!@#$%',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: special characters are displayed correctly
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toHaveText('My app - with special!@#$%')
  }
)

test(
  'APP-DESCRIPTION-005: should display Unicode characters and emojis correctly',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with description containing Unicode and emojis
    // Spec: APP-DESCRIPTION-005
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'Très bien! 你好 🎉',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: Unicode characters and emojis are displayed correctly
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toHaveText('Très bien! 你好 🎉')
  }
)

test(
  'APP-DESCRIPTION-006: should wrap long description properly and remain visible',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with very long description (500+ characters)
    // Spec: APP-DESCRIPTION-006
    const longDescription =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. ' +
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum. ' +
      'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia. ' +
      'Deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste. ' +
      'Natus error sit voluptatem accusantium doloremque laudantium totam rem.'

    await startServerWithSchema(
      {
        name: 'test-app',
        description: longDescription,
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description wraps properly and remains visible
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeVisible()
    await expect(description).toHaveText(longDescription)
  }
)

test(
  'APP-DESCRIPTION-007: should NOT render description element when description is empty string',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with empty string description (not undefined)
    // Spec: APP-DESCRIPTION-007
    await startServerWithSchema(
      {
        name: 'test-app',
        description: '',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description element is NOT rendered
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeHidden()
  }
)

test(
  'APP-DESCRIPTION-008: should render description as a paragraph element',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with description
    // Spec: APP-DESCRIPTION-008
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'A simple application',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description is rendered as a paragraph (<p>) element
    const description = page.locator('p[data-testid="app-description"]')
    await expect(description).toBeVisible()
  }
)

test(
  'APP-DESCRIPTION-009: should center description horizontally',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with description
    // Spec: APP-DESCRIPTION-009
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'A simple application',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description is centered horizontally
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeVisible()

    // Verify text-align: center or flexbox centering
    const styles = await description.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        textAlign: computed.textAlign,
      }
    })

    // THEN: assertion
    expect(styles.textAlign).toBe('center')
  }
)

test(
  'APP-DESCRIPTION-010: should display description in viewport',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with description
    // Spec: APP-DESCRIPTION-010
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'A simple application',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: description is visible and in viewport
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeVisible()
    await expect(description).toBeInViewport()
  }
)

test(
  'APP-DESCRIPTION-011: should display text exactly as input without transformation',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with description containing mixed case, special chars, and whitespace
    // Spec: APP-DESCRIPTION-011
    const originalText = 'MiXeD CaSe!  With   Spaces  & Special@#$%'

    await startServerWithSchema(
      {
        name: 'test-app',
        description: originalText,
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: text content exactly matches input (no transformation)
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toHaveText(originalText)
  }
)

test(
  'APP-DESCRIPTION-012: should display all elements in correct order: version → title → description',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with version, name, and description
    // Spec: APP-DESCRIPTION-012
    await startServerWithSchema(
      {
        version: '1.0.0',
        name: 'test-app',
        description: 'A simple application',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: all elements appear in correct order: version → title → description
    const version = page.locator('[data-testid="app-version-badge"]')
    const title = page.locator('h1[data-testid="app-name-heading"]')
    const description = page.locator('[data-testid="app-description"]')

    // THEN: assertion
    await expect(version).toBeVisible()
    await expect(title).toBeVisible()
    await expect(description).toBeVisible()

    // Verify DOM order
    const versionBox = await version.boundingBox()
    const titleBox = await title.boundingBox()
    const descriptionBox = await description.boundingBox()

    // THEN: assertion
    expect(versionBox).not.toBeNull()
    expect(titleBox).not.toBeNull()
    expect(descriptionBox).not.toBeNull()

    // THEN: assertion
    expect(versionBox!.y).toBeLessThan(titleBox!.y)
    expect(titleBox!.y).toBeLessThan(descriptionBox!.y)
  }
)

test(
  'APP-DESCRIPTION-013: should display full description without truncation for very long text',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with very long description (1000+ characters)
    // Spec: APP-DESCRIPTION-013
    const veryLongDescription =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20) +
      'Final sentence to verify complete rendering without any truncation.'

    await startServerWithSchema(
      {
        name: 'test-app',
        description: veryLongDescription,
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: full description is displayed without truncation
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeVisible()
    await expect(description).toHaveText(veryLongDescription)

    // Verify no CSS text truncation (ellipsis)
    const styles = await description.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        textOverflow: computed.textOverflow,
        overflow: computed.overflow,
      }
    })

    // THEN: assertion
    expect(styles.textOverflow).not.toBe('ellipsis')
  }
)

test(
  'APP-DESCRIPTION-014: should escape HTML tags and display as text',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with description containing HTML-like tags
    // Spec: APP-DESCRIPTION-014
    await startServerWithSchema(
      {
        name: 'test-app',
        description: '<script>alert(1)</script>',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: HTML tags are escaped and displayed as text (not rendered as HTML)
    const description = page.locator('[data-testid="app-description"]')
    await expect(description).toBeVisible()
    await expect(description).toHaveText('<script>alert(1)</script>')

    // Verify no script element was created
    const scriptElement = page.locator('script:has-text("alert(1)")')
    // THEN: assertion
    await expect(scriptElement).toHaveCount(0)
  }
)

test(
  'APP-DESCRIPTION-015: should have appropriate spacing between title and description',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with name and description
    // Spec: APP-DESCRIPTION-015
    await startServerWithSchema(
      {
        name: 'test-app',
        description: 'A simple application',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: appropriate spacing exists between title and description
    const title = page.locator('h1[data-testid="app-name-heading"]')
    const description = page.locator('[data-testid="app-description"]')

    // THEN: assertion
    await expect(title).toBeVisible()
    await expect(description).toBeVisible()

    // Verify spacing (gap should be > 0 pixels)
    const titleBox = await title.boundingBox()
    const descriptionBox = await description.boundingBox()

    // THEN: assertion
    expect(titleBox).not.toBeNull()
    expect(descriptionBox).not.toBeNull()

    const spacing = descriptionBox!.y - (titleBox!.y + titleBox!.height)
    // THEN: assertion
    expect(spacing).toBeGreaterThan(0)
  }
)

// ============================================================================
// REGRESSION TEST (@regression)
// ONE consolidated test covering complete workflow
// Run during: CI/CD, pre-release (bun test:e2e:regression)
//
// Optimization: Reduced from 10 server restarts to 4 by batching related scenarios
// ============================================================================

test(
  'APP-DESCRIPTION-016: user can view complete app description in all scenarios',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Setup: Start server with complex description', async () => {
      await startServerWithSchema(
        {
          name: 'test-app',
          description: 'MiXeD CaSe!  With   Spaces  & Special@#$% Très bien! 你好 🎉',
        },
        { useDatabase: false }
      )
    })

    await test.step('Verify core display, layout, and styling', async () => {
      await page.goto('/')
      const description = page.locator('[data-testid="app-description"]')
      const title = page.locator('h1[data-testid="app-name-heading"]')

      await expect(description).toBeVisible()
      await expect(description).toHaveText(
        'MiXeD CaSe!  With   Spaces  & Special@#$% Très bien! 你好 🎉'
      )

      const paragraph = page.locator('p[data-testid="app-description"]')
      await expect(paragraph).toBeVisible()
      await expect(description).toBeInViewport()

      const textAlign = await description.evaluate((el) => window.getComputedStyle(el).textAlign)
      expect(textAlign).toBe('center')

      await expect(title).toBeVisible()
      const titleBox = await title.boundingBox()
      const descriptionBox = await description.boundingBox()

      expect(titleBox).not.toBeNull()
      expect(descriptionBox).not.toBeNull()
      expect(titleBox!.y).toBeLessThan(descriptionBox!.y)

      const spacing = descriptionBox!.y - (titleBox!.y + titleBox!.height)
      expect(spacing).toBeGreaterThan(0)
    })

    await test.step('Verify missing and empty description handling', async () => {
      await startServerWithSchema(
        {
          name: 'test-app',
        },
        { useDatabase: false }
      )
      await page.goto('/')

      let hiddenDescription = page.locator('[data-testid="app-description"]')
      await expect(hiddenDescription).toBeHidden()

      await startServerWithSchema(
        {
          name: 'test-app',
          description: '',
        },
        { useDatabase: false }
      )
      await page.goto('/')

      hiddenDescription = page.locator('[data-testid="app-description"]')
      await expect(hiddenDescription).toBeHidden()
    })

    await test.step('Verify long text handling and no truncation', async () => {
      const veryLongDescription =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20) +
        'Final sentence to verify complete rendering without any truncation.'

      await startServerWithSchema(
        {
          name: 'test-app',
          description: veryLongDescription,
        },
        { useDatabase: false }
      )
      await page.goto('/')

      const longDescription = page.locator('[data-testid="app-description"]')
      await expect(longDescription).toBeVisible()
      await expect(longDescription).toHaveText(veryLongDescription)

      const textOverflow = await longDescription.evaluate(
        (el) => window.getComputedStyle(el).textOverflow
      )
      expect(textOverflow).not.toBe('ellipsis')
    })

    await test.step('Verify complete layout integration and security', async () => {
      await startServerWithSchema(
        {
          version: '1.0.0',
          name: 'test-app',
          description: '<script>alert(1)</script>',
        },
        { useDatabase: false }
      )
      await page.goto('/')

      const version = page.locator('[data-testid="app-version-badge"]')
      const finalTitle = page.locator('h1[data-testid="app-name-heading"]')
      const finalDescription = page.locator('[data-testid="app-description"]')

      await expect(version).toBeVisible()
      await expect(finalTitle).toBeVisible()
      await expect(finalDescription).toBeVisible()

      const versionBox = await version.boundingBox()
      const finalTitleBox = await finalTitle.boundingBox()
      const finalDescriptionBox = await finalDescription.boundingBox()

      expect(versionBox).not.toBeNull()
      expect(finalTitleBox).not.toBeNull()
      expect(finalDescriptionBox).not.toBeNull()

      expect(versionBox!.y).toBeLessThan(finalTitleBox!.y)
      expect(finalTitleBox!.y).toBeLessThan(finalDescriptionBox!.y)

      await expect(finalDescription).toHaveText('<script>alert(1)</script>')

      const scriptElement = page.locator('script:has-text("alert(1)")')
      await expect(scriptElement).toHaveCount(0)
    })
  }
)
