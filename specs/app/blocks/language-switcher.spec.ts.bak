/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Language Switcher Block
 *
 * Source: src/domain/models/app/block/language-switcher.ts
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Language Switcher Block', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  // APP-BLOCKS-LANGUAGE-SWITCHER-001: Dropdown variant
  test(
    'APP-BLOCKS-LANGUAGE-SWITCHER-001: should render a dropdown menu with all supported languages',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language-switcher block with dropdown variant
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'Français' },
            { code: 'es', locale: 'es-ES', label: 'Español' },
          ],
        },
        blocks: [
          {
            name: 'language-switcher',
            type: 'language-switcher',
            props: {
              variant: 'dropdown',
            },
          },
        ],
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: variant is set to dropdown
      await page.goto('/')

      // THEN: it should render a dropdown menu with all supported languages
      const switcher = page.locator('[data-testid="language-switcher"]')
      await expect(switcher).toBeVisible()

      // Click button to open dropdown (SSR + vanilla JS architecture)
      await page.locator('[data-testid="language-switcher-button"]').click()

      // THEN: assertion
      await expect(page.locator('[data-testid="language-option-en-US"]')).toBeVisible()
      await expect(page.locator('[data-testid="language-option-fr-FR"]')).toBeVisible()
      await expect(page.locator('[data-testid="language-option-es-ES"]')).toBeVisible()
    }
  )

  // APP-BLOCKS-LANGUAGE-SWITCHER-002: ShowFlags enabled
  test(
    'APP-BLOCKS-LANGUAGE-SWITCHER-002: should display flag emojis next to language labels',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language-switcher block with showFlags enabled
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English', flag: '🇺🇸' },
            { code: 'fr', locale: 'fr-FR', label: 'Français', flag: '🇫🇷' },
          ],
        },
        blocks: [
          {
            name: 'language-switcher',
            type: 'language-switcher',
            props: {
              variant: 'inline',
              showFlags: true,
            },
          },
        ],
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: showFlags is set to true
      await page.goto('/')

      // THEN: it should display flag emojis next to language labels
      const enOption = page.locator('[data-testid="language-option-en-US"]')
      await expect(enOption).toContainText('🇺🇸')
      await expect(enOption).toContainText('English')

      const frOption = page.locator('[data-testid="language-option-fr-FR"]')
      // THEN: assertion
      await expect(frOption).toContainText('🇫🇷')
      await expect(frOption).toContainText('Français')
    }
  )

  // APP-BLOCKS-LANGUAGE-SWITCHER-003: Minimal configuration
  test(
    'APP-BLOCKS-LANGUAGE-SWITCHER-003: should use default variant (dropdown) and no flags',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language-switcher block with minimal configuration
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'Français' },
          ],
        },
        blocks: [
          {
            name: 'language-switcher',
            type: 'language-switcher',
          },
        ],
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: only required properties are provided
      await page.goto('/')

      // THEN: it should use default variant (dropdown) and no flags
      const switcher = page.locator('[data-testid="language-switcher"]')
      await expect(switcher).toBeVisible()
      await expect(switcher).toHaveAttribute('data-variant', 'dropdown')

      // Verify no flag emojis are displayed
      const enOption = page.locator('[data-testid="language-option-en-US"]')
      // THEN: assertion
      await expect(enOption).toContainText('English')
      await expect(enOption).not.toContainText('🇺🇸')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 3 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-BLOCKS-LANGUAGE-SWITCHER-REGRESSION: user can complete full language-switcher workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-BLOCKS-LANGUAGE-SWITCHER-001: Render dropdown menu with all supported languages', async () => {
        await startServerWithSchema({
          name: 'test-app',
          languages: {
            default: 'en',
            supported: [
              { code: 'en', locale: 'en-US', label: 'English' },
              { code: 'fr', locale: 'fr-FR', label: 'Français' },
              { code: 'es', locale: 'es-ES', label: 'Español' },
            ],
          },
          blocks: [
            {
              name: 'language-switcher',
              type: 'language-switcher',
              props: { variant: 'dropdown' },
            },
          ],
          pages: [
            {
              name: 'Home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test' },
              sections: [{ block: 'language-switcher' }],
            },
          ],
        })
        await page.goto('/')
        const switcher = page.locator('[data-testid="language-switcher"]')
        await expect(switcher).toBeVisible()
        await page.locator('[data-testid="language-switcher-button"]').click()
        await expect(page.locator('[data-testid="language-option-en-US"]')).toBeVisible()
        await expect(page.locator('[data-testid="language-option-fr-FR"]')).toBeVisible()
        await expect(page.locator('[data-testid="language-option-es-ES"]')).toBeVisible()
      })

      await test.step('APP-BLOCKS-LANGUAGE-SWITCHER-002: Display flag emojis next to language labels', async () => {
        await startServerWithSchema({
          name: 'test-app',
          languages: {
            default: 'en',
            supported: [
              { code: 'en', locale: 'en-US', label: 'English', flag: '🇺🇸' },
              { code: 'fr', locale: 'fr-FR', label: 'Français', flag: '🇫🇷' },
            ],
          },
          blocks: [
            {
              name: 'language-switcher',
              type: 'language-switcher',
              props: { variant: 'inline', showFlags: true },
            },
          ],
          pages: [
            {
              name: 'Home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test' },
              sections: [{ block: 'language-switcher' }],
            },
          ],
        })
        await page.goto('/')
        const enOption = page.locator('[data-testid="language-option-en-US"]')
        await expect(enOption).toContainText('🇺🇸')
        await expect(enOption).toContainText('English')
        const frOption = page.locator('[data-testid="language-option-fr-FR"]')
        await expect(frOption).toContainText('🇫🇷')
        await expect(frOption).toContainText('Français')
      })

      await test.step('APP-BLOCKS-LANGUAGE-SWITCHER-003: Use default variant (dropdown) and no flags', async () => {
        await startServerWithSchema({
          name: 'test-app',
          languages: {
            default: 'en',
            supported: [
              { code: 'en', locale: 'en-US', label: 'English' },
              { code: 'fr', locale: 'fr-FR', label: 'Français' },
            ],
          },
          blocks: [
            {
              name: 'language-switcher',
              type: 'language-switcher',
            },
          ],
          pages: [
            {
              name: 'Home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test' },
              sections: [{ block: 'language-switcher' }],
            },
          ],
        })
        await page.goto('/')
        const switcher = page.locator('[data-testid="language-switcher"]')
        await expect(switcher).toBeVisible()
        await expect(switcher).toHaveAttribute('data-variant', 'dropdown')
        const enOption = page.locator('[data-testid="language-option-en-US"]')
        await expect(enOption).toContainText('English')
        await expect(enOption).not.toContainText('🇺🇸')
      })
    }
  )
})
