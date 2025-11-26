/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
// eslint-disable-next-line import/extensions -- JSON imports require extension
import landingPageJson from '../../templates/landing-page.json' with { type: 'json' }
import type { App } from '@/domain/models/app'

// Cast JSON import to App type (JSON imports lose literal type information)
const landingPageSchema = landingPageJson as unknown as App

/**
 * E2E Test for Landing Page Template
 *
 * Source: templates/landing-page.ts
 *
 * This single comprehensive regression test validates the complete landing page
 * template functionality.
 *
 * Note: We define the schema inline rather than importing from templates/landing-page.ts
 * because that file imports from @/index which chains to Bun-specific modules
 * (drizzle-orm/bun-sql) that cannot be resolved in Playwright's Node.js context.
 *
 * Covered Features:
 * - Navigation rendering with branding and menu items
 * - Hero section with blocks and variable substitution
 * - Features section with reusable feature-card blocks
 * - CTA section with cta-button block
 * - Footer with copyright text
 * - Multi-language support (English/French) with switching
 * - Theme colors and fonts application
 * - Hash navigation and scrolling
 * - Responsive grid layout (mobile/desktop)
 * - Language persistence across page reload
 * - Hover effects on buttons
 * - Complete user journey workflow
 */

test.describe('Landing Page Template', () => {
  test(
    'TEMPLATES-LANDING-PAGE-001: comprehensive landing page validation',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // ========================================================================
      // SETUP: Start server with landing page schema
      // ========================================================================
      await startServerWithSchema(landingPageSchema)

      // ========================================================================
      // STEP 1: Initial Page Load & Navigation Rendering
      // ========================================================================
      await test.step('1: Page loads with navigation and branding', async () => {
        await page.goto('/')

        // Page title contains Sovrium
        await expect(page).toHaveTitle(/Sovrium/)

        // Navigation is visible with Sovrium branding
        const nav = page.locator('nav')
        await expect(nav).toBeVisible()
        await expect(nav).toContainText('Sovrium')

        // All menu items render with correct English translations
        await expect(page.locator('a[href="#home"]')).toHaveText('Home')
        await expect(page.locator('a[href="#features"]')).toHaveText('Features')
        await expect(page.locator('a[href="#pricing"]')).toHaveText('Pricing')
        await expect(page.locator('a[href="#contact"]')).toHaveText('Contact')
      })

      // ========================================================================
      // STEP 2: Hero Section with Block Variable Substitution
      // ========================================================================
      await test.step('2: Hero section renders with substituted variables', async () => {
        // Hero title and subtitle render from hero-section block
        await expect(page.locator('h1')).toHaveText('Build Your Next App with Sovrium')
        await expect(
          page.locator('p:has-text("A modern, configuration-driven platform")')
        ).toBeVisible()

        // CTA buttons render with correct text
        await expect(page.locator('button:has-text("Get Started")')).toBeVisible()
        await expect(page.locator('button:has-text("Learn More")')).toBeVisible()

        // hero-section block has no unsubstituted variables
        const heroSection = page.locator('[data-block="hero-section"]')
        await expect(heroSection).toBeVisible()
        const heroHtml = await heroSection.innerHTML()
        expect(heroHtml).not.toContain('$title')
        expect(heroHtml).not.toContain('$subtitle')
        expect(heroHtml).not.toContain('$ctaPrimary')
        expect(heroHtml).not.toContain('$ctaSecondary')
      })

      // ========================================================================
      // STEP 3: Features Section with Reusable Blocks
      // ========================================================================
      await test.step('3: Features section renders with three feature cards', async () => {
        // Section title and subtitle
        await expect(page.locator('h2:has-text("Why Choose Sovrium?")')).toBeVisible()
        await expect(
          page.locator('p:has-text("Everything you need to build modern applications")')
        ).toBeVisible()

        // Three feature-card blocks render
        const featureCards = page.locator('[data-block="feature-card"]')
        await expect(featureCards).toHaveCount(3)

        // Each card has correct content
        await expect(page.locator('h3:has-text("Declarative Configuration")')).toBeVisible()
        await expect(page.locator('h3:has-text("Type-Safe by Default")')).toBeVisible()
        await expect(page.locator('h3:has-text("Reactive & Fast")')).toBeVisible()

        // Feature cards have no unsubstituted variables
        const firstCard = featureCards.first()
        const cardHtml = await firstCard.innerHTML()
        expect(cardHtml).not.toContain('$icon')
        expect(cardHtml).not.toContain('$title')
        expect(cardHtml).not.toContain('$description')
      })

      // ========================================================================
      // STEP 4: CTA Section with Block
      // ========================================================================
      await test.step('4: CTA section renders with cta-button block', async () => {
        await expect(page.locator('h2:has-text("Ready to get started?")')).toBeVisible()
        await expect(
          page.locator('p:has-text("Join thousands of developers building with Sovrium")')
        ).toBeVisible()

        // cta-button block renders with substituted label
        const ctaButton = page.locator('[data-block="cta-button"]')
        await expect(ctaButton).toBeVisible()
        await expect(ctaButton).toHaveText('Start Building Now')

        const ctaHtml = await ctaButton.innerHTML()
        expect(ctaHtml).not.toContain('$label')
      })

      // ========================================================================
      // STEP 5: Footer Section
      // ========================================================================
      await test.step('5: Footer renders with copyright text', async () => {
        await expect(page.locator('p:has-text("© 2025 Sovrium")')).toBeVisible()
        await expect(page.locator('p:has-text("All rights reserved")')).toBeVisible()
      })

      // ========================================================================
      // STEP 6: Theme Colors Application
      // ========================================================================
      await test.step('6: Theme colors are applied correctly', async () => {
        // Primary color (#3b82f6) on primary button
        const primaryButton = page.locator('button:has-text("Get Started")')
        await expect(primaryButton).toHaveCSS('background-color', 'rgb(59, 130, 246)')

        // Primary color on branding text
        const branding = page.locator('nav').locator('text=Sovrium')
        const brandingColor = await branding.evaluate((el) => window.getComputedStyle(el).color)
        expect(brandingColor).toBe('rgb(59, 130, 246)')

        // Secondary button border color
        const secondaryButton = page.locator('button:has-text("Learn More")')
        await expect(secondaryButton).toHaveCSS('border-color', 'rgb(59, 130, 246)')

        // CTA section background
        const ctaSection = page.locator('section:has(h2:has-text("Ready to get started?"))')
        await expect(ctaSection).toHaveCSS('background-color', 'rgb(59, 130, 246)')

        // Footer background (gray-900: #111827)
        const footer = page.locator('section:has(p:has-text("© 2025 Sovrium"))')
        await expect(footer).toHaveCSS('background-color', 'rgb(17, 24, 39)')
      })

      // ========================================================================
      // STEP 7: Theme Fonts Application
      // ========================================================================
      await test.step('7: Theme fonts are applied correctly', async () => {
        // Heading font (Inter)
        const heading = page.locator('h1')
        const headingFont = await heading.evaluate((el) => window.getComputedStyle(el).fontFamily)
        expect(headingFont).toContain('Inter')

        // Body font (Inter)
        const bodyText = page.locator('p').first()
        const bodyFont = await bodyText.evaluate((el) => window.getComputedStyle(el).fontFamily)
        expect(bodyFont).toContain('Inter')

        // Heading letter-spacing (-0.02em)
        const letterSpacing = await heading.evaluate(
          (el) => window.getComputedStyle(el).letterSpacing
        )
        expect(parseFloat(letterSpacing)).toBeLessThan(0)
      })

      // ========================================================================
      // STEP 8: Button Hover Effects
      // ========================================================================
      await test.step('8: Hover effects apply to buttons', async () => {
        const primaryButton = page.locator('button:has-text("Get Started")')
        await primaryButton.hover()

        // Hover color (#2563eb) is applied
        await expect(primaryButton).toHaveCSS('background-color', 'rgb(37, 99, 235)')
      })

      // ========================================================================
      // STEP 9: Hash Navigation
      // ========================================================================
      await test.step('9: Hash navigation scrolls to correct sections', async () => {
        // Click Features link
        await page.locator('a[href="#features"]').click()
        const featuresSection = page.locator('#features')
        await expect(featuresSection).toBeInViewport()

        // Click Home link to scroll back
        await page.locator('a[href="#home"]').click()
        await expect(page.locator('h1:has-text("Build Your Next App")')).toBeInViewport()
      })

      // ========================================================================
      // STEP 10: Language Switching (English to French)
      // ========================================================================
      await test.step('10: Language switches from English to French', async () => {
        const languageSwitcher = page.locator('[data-testid="language-switcher"]')
        await languageSwitcher.click()
        await page.locator('button:has-text("Français")').click()

        // All content updates to French
        await expect(page.locator('h1')).toHaveText(
          'Créez votre prochaine application avec Sovrium'
        )
        await expect(page.locator('a[href="#home"]')).toHaveText('Accueil')
        await expect(page.locator('a[href="#features"]')).toHaveText('Fonctionnalités')
        await expect(page.locator('a[href="#pricing"]')).toHaveText('Tarifs')
        await expect(page.locator('a[href="#contact"]')).toHaveText('Contact')
        await expect(page.locator('button:has-text("Commencer")')).toBeVisible()
        await expect(page.locator('button:has-text("En savoir plus")')).toBeVisible()
        await expect(page.locator('h2:has-text("Pourquoi choisir Sovrium?")')).toBeVisible()
        await expect(page.locator('h3:has-text("Configuration déclarative")')).toBeVisible()
        await expect(page.locator('h3:has-text("Type-safe par défaut")')).toBeVisible()
        await expect(page.locator('h3:has-text("Réactif et rapide")')).toBeVisible()
        await expect(page.locator('h2:has-text("Prêt à commencer?")')).toBeVisible()
        await expect(page.locator('button:has-text("Commencer maintenant")')).toBeVisible()
        await expect(page.locator('p:has-text("Tous droits réservés")')).toBeVisible()
      })

      // ========================================================================
      // STEP 11: Language Persistence Across Reload
      // ========================================================================
      await test.step('11: French language persists after page reload', async () => {
        await page.reload()

        // French content still displays after reload
        await expect(page.locator('h1')).toHaveText(
          'Créez votre prochaine application avec Sovrium'
        )
        await expect(page.locator('a[href="#home"]')).toHaveText('Accueil')
      })

      // ========================================================================
      // STEP 12: Language Switching Back to English
      // ========================================================================
      await test.step('12: Language switches back to English', async () => {
        const languageSwitcher = page.locator('[data-testid="language-switcher"]')
        await languageSwitcher.click()
        await page.locator('button:has-text("English")').click()

        // Content reverts to English
        await expect(page.locator('h1')).toHaveText('Build Your Next App with Sovrium')
        await expect(page.locator('a[href="#home"]')).toHaveText('Home')
      })

      // ========================================================================
      // STEP 13: Responsive Layout - Mobile Viewport
      // ========================================================================
      await test.step('13: Mobile viewport shows stacked feature cards', async () => {
        await page.setViewportSize({ width: 375, height: 667 })
        await page.reload()

        const featureCards = page.locator('[data-block="feature-card"]')
        await expect(featureCards).toHaveCount(3)

        // Cards are stacked vertically (second card below first)
        const firstCard = featureCards.nth(0)
        const secondCard = featureCards.nth(1)
        const firstBox = await firstCard.boundingBox()
        const secondBox = await secondCard.boundingBox()

        expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height - 10)
      })

      // ========================================================================
      // STEP 14: Responsive Layout - Desktop Viewport
      // ========================================================================
      await test.step('14: Desktop viewport shows horizontal feature cards', async () => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.reload()

        const featureCards = page.locator('[data-block="feature-card"]')

        // Cards are in same row (similar y positions)
        const firstBox = await featureCards.nth(0).boundingBox()
        const secondBox = await featureCards.nth(1).boundingBox()
        const thirdBox = await featureCards.nth(2).boundingBox()

        expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThan(10)
        expect(Math.abs(secondBox!.y - thirdBox!.y)).toBeLessThan(10)
      })

      // ========================================================================
      // STEP 15: Complete User Journey
      // ========================================================================
      await test.step('15: Complete user journey workflow', async () => {
        // User lands on page and sees value proposition
        await expect(page.locator('h1')).toContainText('Sovrium')
        await expect(page.locator('p:has-text("configuration-driven platform")')).toBeVisible()

        // User navigates to features
        await page.locator('a[href="#features"]').click()
        await expect(page.locator('#features')).toBeInViewport()

        // User reviews feature descriptions
        await expect(
          page.locator('p:has-text("Define your entire application using simple JSON schemas")')
        ).toBeVisible()

        // User switches to French to read in preferred language
        const languageSwitcher = page.locator('[data-testid="language-switcher"]')
        await languageSwitcher.click()
        await page.locator('button:has-text("Français")').click()
        await expect(page.locator('h3:has-text("Configuration déclarative")')).toBeVisible()

        // User scrolls to CTA section
        await page.locator('h2:has-text("Prêt à commencer?")').scrollIntoViewIfNeeded()
        await expect(page.locator('h2:has-text("Prêt à commencer?")')).toBeInViewport()

        // User clicks CTA button
        const ctaButton = page.locator('button:has-text("Commencer maintenant")')
        await expect(ctaButton).toBeVisible()
        await ctaButton.click()

        // User sees footer
        await page.locator('p:has-text("Tous droits réservés")').scrollIntoViewIfNeeded()
        await expect(page.locator('p:has-text("© 2025 Sovrium")')).toBeVisible()

        // User returns to top
        await page.locator('a[href="#home"]').click()
        await expect(page.locator('h1')).toBeInViewport()
      })
    }
  )
})
