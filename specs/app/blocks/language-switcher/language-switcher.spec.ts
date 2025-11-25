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
 * Source: specs/app/blocks/language-switcher/language-switcher.schema.json
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
      await expect(enOption).toContainText('English')
      await expect(enOption).not.toContainText('🇺🇸')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE comprehensive test - validates end-to-end workflow efficiently
  // ============================================================================

  test(
    'APP-BLOCKS-LANGUAGE-SWITCHER-REGRESSION-001: user can complete full language-switcher workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: complete application configuration with all features
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          persistSelection: true,
          supported: [
            { code: 'en', locale: 'en-US', label: 'English', flag: '🇺🇸' },
            { code: 'fr', locale: 'fr-FR', label: 'Français', flag: '🇫🇷' },
            { code: 'es', locale: 'es-ES', label: 'Español', flag: '🇪🇸' },
          ],
        },
        blocks: [
          {
            name: 'language-switcher',
            type: 'language-switcher',
            props: {
              variant: 'dropdown',
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

      await page.goto('/')

      // WHEN: user completes full workflow
      // Step 1: Verify initial state (English)
      const htmlLang = page.locator('html')
      await expect(htmlLang).toHaveAttribute('lang', 'en-US')

      // Step 2: Click language switcher to open dropdown
      const switcher = page.locator('[data-testid="language-switcher"]')
      await expect(switcher).toBeVisible()
      await switcher.click()

      // Step 3: Select French from dropdown
      await page.locator('[data-testid="language-option-fr-FR"]').click()

      // Step 4: Verify language changed to French
      const newHtmlLang = page.locator('html')
      await expect(newHtmlLang).toHaveAttribute('lang', 'fr-FR')

      // Step 5: Verify localStorage persisted the choice
      const storedLanguage = await page.evaluate(() => localStorage.getItem('sovrium_language'))
      expect(storedLanguage).toBe('fr')

      // THEN: user can complete full language-switcher workflow
      // All features work together: dropdown variant, flags, language switching, persistence
    }
  )
})
