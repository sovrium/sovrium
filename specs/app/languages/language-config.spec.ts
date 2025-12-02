/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Language Configuration
 *
 * Source: src/domain/models/app/languages.ts
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Language Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-LANGUAGES-CONFIG-001: should be valid with LTR direction by default',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language config for English (en-US)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            {
              code: 'en',
              locale: 'en-US',
              label: 'English',
            },
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
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: language is defined with code and label
      await page.goto('/')

      // THEN: it should be valid with LTR direction by default
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
      await expect(page.locator('[data-testid="current-language"]')).toHaveText('English')
    }
  )

  test(
    'APP-LANGUAGES-CONFIG-002: should support right-to-left text rendering',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language config for Arabic (ar-SA) with rtl direction
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'ar',
          supported: [
            {
              code: 'ar',
              locale: 'ar-SA',
              label: 'العربية',
              direction: 'rtl',
            },
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
            name: 'home',
            path: '/',
            meta: { lang: 'ar-SA', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: language is defined with RTL direction
      await page.goto('/')

      // THEN: it should support right-to-left text rendering
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(page.locator('[data-testid="current-language"]')).toHaveText('العربية')
      await expect(page.locator('body')).toHaveCSS('direction', 'rtl')
    }
  )

  test(
    'APP-LANGUAGES-CONFIG-003: should be valid with 2-letter code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language config with 2-letter code (en)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            {
              code: 'en',
              label: 'English',
            },
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
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: language code uses ISO 639-1 format without country
      await page.goto('/')

      // THEN: it should be valid
      await expect(page.locator('[data-testid="language-code"]')).toHaveText('en')
      await expect(page.locator('[data-testid="current-language"]')).toHaveText('English')
    }
  )

  test(
    'APP-LANGUAGES-CONFIG-004: should be valid with country-specific format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language config with 4-letter code (en-US)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            {
              code: 'en',
              locale: 'en-US',
              label: 'English (United States)',
            },
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
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: language code includes country code
      await page.goto('/')

      // THEN: it should be valid with country-specific format
      await expect(page.locator('[data-testid="language-code"]')).toHaveText('en-US')
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    }
  )

  test(
    'APP-LANGUAGES-CONFIG-005: should display the flag in language switcher',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language config with flag emoji (🇫🇷)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'fr',
          supported: [
            {
              code: 'fr',
              locale: 'fr-FR',
              label: 'Français',
              direction: 'ltr',
              flag: '🇫🇷',
            },
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
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: flag is provided as unicode emoji
      await page.goto('/')
      await page.locator('[data-testid="language-switcher"]').click()

      // THEN: it should display the flag in language switcher
      await expect(page.locator('[data-testid="language-flag"]')).toHaveText('🇫🇷')
      await expect(page.locator('[data-testid="language-option-fr-FR"]')).toContainText('🇫🇷')
    }
  )

  test(
    'APP-LANGUAGES-CONFIG-006: should load the flag image from the path',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language config with flag icon path (/flags/es.svg)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'es',
          supported: [
            {
              code: 'es',
              locale: 'es-ES',
              label: 'Español',
              direction: 'ltr',
              flag: '/flags/es.svg',
            },
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
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: flag is provided as file path
      await page.goto('/')
      await page.locator('[data-testid="language-switcher"]').click()

      // THEN: it should load the flag image from the path
      await expect(page.locator('[data-testid="language-flag-img"]')).toHaveAttribute(
        'src',
        '/flags/es.svg'
      )
      // THEN: assertion
      await expect(page.locator('[data-testid="language-flag-img"]')).toBeVisible()
    }
  )

  test(
    'APP-LANGUAGES-CONFIG-007: should display correctly in all character sets',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a language config with native language label (Français, Español, العربية)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'Français' },
            { code: 'es', locale: 'es-ES', label: 'Español' },
            { code: 'ar', locale: 'ar-SA', label: 'العربية', direction: 'rtl' },
            { code: 'zh', locale: 'zh-CN', label: '中文' },
            { code: 'ja', locale: 'ja-JP', label: '日本語' },
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
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: label uses the language's native name
      await page.goto('/')
      await page.locator('[data-testid="language-switcher"]').click()

      // THEN: it should display correctly in all character sets
      await expect(page.locator('[data-testid="language-option-fr-FR"]')).toContainText('Français')
      await expect(page.locator('[data-testid="language-option-es-ES"]')).toContainText('Español')
      await expect(page.locator('[data-testid="language-option-ar-SA"]')).toContainText('العربية')
      await expect(page.locator('[data-testid="language-option-zh-CN"]')).toContainText('中文')
      await expect(page.locator('[data-testid="language-option-ja-JP"]')).toContainText('日本語')
    }
  )

  test(
    'APP-LANGUAGES-CONFIG-008: should use default LTR direction and no flag',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a minimal language config with only code and label
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            {
              code: 'en',
              locale: 'en-US',
              label: 'English',
            },
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
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'language-switcher' }],
          },
        ],
      })

      // WHEN: direction and flag are omitted
      await page.goto('/')
      await page.locator('[data-testid="language-switcher"]').click()

      // THEN: it should use default LTR direction and no flag
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
      await expect(page.locator('[data-testid="language-flag"]')).toBeHidden()
      await expect(page.locator('[data-testid="language-option-en-US"]')).toContainText('English')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-LANGUAGES-CONFIG-009: user can complete full language-config workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('Setup: Start server with multi-language configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          languages: {
            default: 'en',
            supported: [
              {
                code: 'en',
                locale: 'en-US',
                label: 'English',
                direction: 'ltr',
                flag: '🇺🇸',
              },
              {
                code: 'fr',
                locale: 'fr-FR',
                label: 'Français',
                direction: 'ltr',
                flag: '🇫🇷',
              },
              {
                code: 'ar',
                locale: 'ar-SA',
                label: 'العربية',
                direction: 'rtl',
                flag: '🇸🇦',
              },
            ],
          },
          blocks: [
            {
              name: 'language-switcher',
              type: 'language-switcher',
              props: {
                showFlags: true,
              },
            },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [{ block: 'language-switcher' }],
            },
          ],
        })
      })

      await test.step('Verify default language and flags', async () => {
        await page.goto('/')

        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
        await expect(page.locator('[data-testid="current-language"]')).toHaveText('English')

        await page.locator('[data-testid="language-switcher"]').click()
        await expect(page.locator('[data-testid="language-option"]')).toHaveCount(3)

        await expect(page.locator('[data-testid="language-option-en-US"]')).toContainText('🇺🇸')
        await expect(page.locator('[data-testid="language-option-fr-FR"]')).toContainText('🇫🇷')
      })

      await test.step('Switch to French and verify', async () => {
        await page.locator('[data-testid="language-option-fr-FR"]').click()
        await expect(page.locator('[data-testid="current-language"]')).toHaveText('Français')
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR')
      })

      await test.step('Switch to Arabic (RTL) and verify', async () => {
        await page.locator('[data-testid="language-switcher"]').click()
        await page.locator('[data-testid="language-option-ar-SA"]').click()
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
        await expect(page.locator('[data-testid="current-language"]')).toHaveText('العربية')
      })
    }
  )
})
