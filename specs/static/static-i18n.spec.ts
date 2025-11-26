/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '@/specs/fixtures'

test.describe('Static Site Generation - Multi-Language Support', () => {
  test(
    'STATIC-I18N-001: should generate language directories',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with multiple languages configured
      const outputDir = await generateStaticSite({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English', locale: 'en-US' },
            { code: 'fr', label: 'Français', locale: 'fr-FR' },
            { code: 'es', label: 'Español', locale: 'es-ES' },
          ],
          translations: {
            en: {
              'welcome.title': 'Welcome',
              'welcome.description': 'Welcome to our site',
              'about.title': 'About Us',
              'about.description': 'Learn more about us',
            },
            fr: {
              'welcome.title': 'Bienvenue',
              'welcome.description': 'Bienvenue sur notre site',
              'about.title': 'À propos',
              'about.description': 'En savoir plus sur nous',
            },
            es: {
              'welcome.title': 'Bienvenido',
              'welcome.description': 'Bienvenido a nuestro sitio',
              'about.title': 'Acerca de',
              'about.description': 'Aprende más sobre nosotros',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              title: '$t:welcome.title',
              description: '$t:welcome.description',
            },
            sections: [
              { type: 'h1', children: ['$t:welcome.title'] },
              { type: 'p', children: ['$t:welcome.description'] },
            ],
          },
          {
            name: 'about',
            path: '/about',
            meta: {
              title: '$t:about.title',
              description: '$t:about.description',
            },
            sections: [
              { type: 'h1', children: ['$t:about.title'] },
              { type: 'p', children: ['$t:about.description'] },
            ],
          },
        ],
      })

      // WHEN: examining generated directory structure
      const files = await readdir(outputDir, { recursive: true, withFileTypes: true })
      const dirs = files
        .filter((f) => f.isDirectory())
        .map((f) => (f.parentPath ? join(f.parentPath.replace(outputDir, ''), f.name) : f.name))
        .map((p) => p.replace(/^\//, ''))

      // THEN: should generate language directories
      expect(dirs).toContain('en')
      expect(dirs).toContain('fr')
      expect(dirs).toContain('es')

      // Verify each language has the same page structure
      const enFiles = await readdir(join(outputDir, 'en'), { recursive: true })
      const frFiles = await readdir(join(outputDir, 'fr'), { recursive: true })
      const esFiles = await readdir(join(outputDir, 'es'), { recursive: true })

      // THEN: assertion
      expect(enFiles).toContain('index.html')
      expect(enFiles).toContain('about.html')
      expect(frFiles).toContain('index.html')
      expect(frFiles).toContain('about.html')
      expect(esFiles).toContain('index.html')
      expect(esFiles).toContain('about.html')

      // Should also generate root redirect or default language
      const rootFiles = await readdir(outputDir, { withFileTypes: true })
      const rootHtmlFiles = rootFiles
        .filter((f) => f.isFile() && f.name.endsWith('.html'))
        .map((f) => f.name)

      // THEN: assertion
      expect(rootHtmlFiles).toContain('index.html') // Root redirect or default language
    }
  )

  test(
    'STATIC-I18N-002: should create language-specific HTML files',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with translations
      const outputDir = await generateStaticSite({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English', locale: 'en-US' },
            { code: 'fr', label: 'Français', locale: 'fr-FR' },
          ],
          translations: {
            en: {
              'home.title': 'Home',
              'home.heading': 'Welcome to Our Site',
              'home.content': 'This is the English version',
            },
            fr: {
              'home.title': 'Accueil',
              'home.heading': 'Bienvenue sur Notre Site',
              'home.content': 'Ceci est la version française',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              title: '$t:home.title',
              description: '$t:home.content',
            },
            sections: [
              {
                type: 'main',
                props: { className: 'container' },
                children: [
                  { type: 'h1', children: ['$t:home.heading'] },
                  { type: 'p', children: ['$t:home.content'] },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: reading language-specific HTML files
      const enHtml = await readFile(join(outputDir, 'en/index.html'), 'utf-8')
      const frHtml = await readFile(join(outputDir, 'fr/index.html'), 'utf-8')

      // THEN: should create language-specific HTML files
      // English version
      expect(enHtml).toContain('<!DOCTYPE html>')
      expect(enHtml).toContain('lang="en-US"')
      expect(enHtml).toContain('<title>Home</title>')
      expect(enHtml).toContain('content="This is the English version"')
      expect(enHtml).toContain('Welcome to Our Site')
      expect(enHtml).toContain('This is the English version')

      // French version
      // THEN: assertion
      expect(frHtml).toContain('<!DOCTYPE html>')
      expect(frHtml).toContain('lang="fr-FR"')
      expect(frHtml).toContain('<title>Accueil</title>')
      expect(frHtml).toContain('content="Ceci est la version française"')
      expect(frHtml).toContain('Bienvenue sur Notre Site')
      expect(frHtml).toContain('Ceci est la version française')

      // Default language at root
      const rootHtml = await readFile(join(outputDir, 'index.html'), 'utf-8')
      // THEN: assertion
      expect(rootHtml).toContain('Welcome to Our Site') // Default to English
    }
  )

  test(
    'STATIC-I18N-003: should generate hreflang links in HTML head',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with multiple languages and baseUrl
      const outputDir = await generateStaticSite({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English', locale: 'en-US' },
            { code: 'fr', label: 'Français', locale: 'fr-FR' },
            { code: 'de', label: 'Deutsch', locale: 'de-DE' },
          ],
          translations: {
            en: { title: 'Home' },
            fr: { title: 'Accueil' },
            de: { title: 'Startseite' },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              title: '$t:title',
            },
            sections: [],
          },
          {
            name: 'about',
            path: '/about',
            meta: {
              title: 'About',
            },
            sections: [],
          },
        ],
      })

      // WHEN: reading HTML files
      const enHome = await readFile(join(outputDir, 'en/index.html'), 'utf-8')
      const frHome = await readFile(join(outputDir, 'fr/index.html'), 'utf-8')
      const deHome = await readFile(join(outputDir, 'de/index.html'), 'utf-8')
      const enAbout = await readFile(join(outputDir, 'en/about.html'), 'utf-8')

      // THEN: should generate hreflang links
      // English home page should have links to other language versions (using full locales)
      expect(enHome).toContain('hreflang="en-US"')
      expect(enHome).toContain('href="/en/"')
      expect(enHome).toContain('hreflang="fr-FR"')
      expect(enHome).toContain('href="/fr/"')
      expect(enHome).toContain('hreflang="de-DE"')
      expect(enHome).toContain('href="/de/"')
      expect(enHome).toContain('hreflang="x-default"')

      // French home page should have the same links
      // THEN: assertion
      expect(frHome).toContain('hreflang="en-US"')
      expect(frHome).toContain('hreflang="fr-FR"')
      expect(frHome).toContain('hreflang="de-DE"')

      // German home page
      // THEN: assertion
      expect(deHome).toContain('hreflang="en-US"')
      expect(deHome).toContain('hreflang="fr-FR"')
      expect(deHome).toContain('hreflang="de-DE"')

      // About page should have correct hreflang links
      // THEN: assertion
      expect(enAbout).toContain('hreflang="en-US"')
      expect(enAbout).toContain('href="/en/about/"')
      expect(enAbout).toContain('hreflang="fr-FR"')
      expect(enAbout).toContain('href="/fr/about/"')
      expect(enAbout).toContain('hreflang="de-DE"')
      expect(enAbout).toContain('href="/de/about/"')

      // Note: Canonical URLs would require baseUrl configuration (not tested here)
    }
  )

  test(
    'STATIC-I18N-004: should create language switcher links',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with language switcher in layout
      const outputDir = await generateStaticSite({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English', locale: 'en-US' },
            { code: 'fr', label: 'Français', locale: 'fr-FR' },
            { code: 'es', label: 'Español', locale: 'es-ES' },
          ],
          translations: {
            en: {
              'nav.home': 'Home',
              'nav.about': 'About',
              'lang.switch': 'Language',
              'lang.en': 'English',
              'lang.fr': 'Français',
              'lang.es': 'Español',
            },
            fr: {
              'nav.home': 'Accueil',
              'nav.about': 'À propos',
              'lang.switch': 'Langue',
              'lang.en': 'English',
              'lang.fr': 'Français',
              'lang.es': 'Español',
            },
            es: {
              'nav.home': 'Inicio',
              'nav.about': 'Acerca de',
              'lang.switch': 'Idioma',
              'lang.en': 'English',
              'lang.fr': 'Français',
              'lang.es': 'Español',
            },
          },
        },
        defaultLayout: {
          navigation: {
            logo: './logo.svg',
            links: {
              desktop: [
                { label: '$t:nav.home', href: '/' },
                { label: '$t:nav.about', href: '/about' },
              ],
            },
            languageSwitcher: {
              label: '$t:lang.switch',
              items: [
                { lang: 'en', label: '$t:lang.en', href: '/en{{currentPath}}' },
                { lang: 'fr', label: '$t:lang.fr', href: '/fr{{currentPath}}' },
                { lang: 'es', label: '$t:lang.es', href: '/es{{currentPath}}' },
              ],
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { title: '$t:nav.home' },
            sections: [],
          },
          {
            name: 'about',
            path: '/about',
            meta: { title: '$t:nav.about' },
            sections: [],
          },
        ],
      })

      // WHEN: reading HTML files
      const enHome = await readFile(join(outputDir, 'en/index.html'), 'utf-8')
      const frHome = await readFile(join(outputDir, 'fr/index.html'), 'utf-8')
      const esAbout = await readFile(join(outputDir, 'es/about.html'), 'utf-8')

      // THEN: should create language switcher links
      // English home page should have language switcher
      expect(enHome).toContain('Language') // Label
      expect(enHome).toContain('href="/en/"')
      expect(enHome).toMatch(/>\s*English\s*<\/a/s)
      expect(enHome).toContain('href="/fr/"')
      expect(enHome).toMatch(/>\s*Français\s*<\/a/s)
      expect(enHome).toContain('href="/es/"')
      expect(enHome).toMatch(/>\s*Español\s*<\/a/s)

      // French home page
      // THEN: assertion
      expect(frHome).toContain('Langue') // Label in French
      expect(frHome).toContain('href="/en/"')
      expect(frHome).toMatch(/>\s*English\s*<\/a/s)
      expect(frHome).toContain('href="/fr/"')
      expect(frHome).toMatch(/>\s*Français\s*<\/a/s)
      expect(frHome).toContain('href="/es/"')
      expect(frHome).toMatch(/>\s*Español\s*<\/a/s)

      // Spanish about page - should link to about page in other languages
      // THEN: assertion
      expect(esAbout).toContain('Idioma') // Label in Spanish
      expect(esAbout).toContain('href="/en/about"')
      expect(esAbout).toMatch(/>\s*English\s*<\/a/s)
      expect(esAbout).toContain('href="/fr/about"')
      expect(esAbout).toMatch(/>\s*Français\s*<\/a/s)
      expect(esAbout).toContain('href="/es/about"')
      expect(esAbout).toMatch(/>\s*Español\s*<\/a/s)

      // Navigation should be translated
      // THEN: assertion
      expect(enHome).toContain('Home')
      expect(enHome).toContain('About')
      expect(frHome).toContain('Accueil')
      expect(frHome).toContain('À propos')
      expect(esAbout).toContain('Inicio')
      expect(esAbout).toContain('Acerca de')
    }
  )

  test(
    'STATIC-I18N-REGRESSION-001: complete multi-language workflow',
    { tag: '@regression' },
    async ({ generateStaticSite, page }) => {
      // GIVEN: complete multi-language app
      const outputDir = await generateStaticSite({
        name: 'test-app',
        description: 'Multi-language test application',
        theme: {
          colors: { primary: '#3B82F6' },
        },
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English', locale: 'en-US' },
            { code: 'fr', label: 'Français', locale: 'fr-FR' },
          ],
          translations: {
            en: {
              'site.title': 'Multilingual Site',
              'home.welcome': 'Welcome',
              'home.description': 'This site is available in multiple languages',
              'home.cta': 'Learn More',
              'about.title': 'About Us',
              'about.content': 'We are an international company',
            },
            fr: {
              'site.title': 'Site Multilingue',
              'home.welcome': 'Bienvenue',
              'home.description': 'Ce site est disponible en plusieurs langues',
              'home.cta': 'En Savoir Plus',
              'about.title': 'À Propos',
              'about.content': 'Nous sommes une entreprise internationale',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              title: '$t:home.welcome - $t:site.title',
              description: '$t:home.description',
            },
            sections: [
              {
                type: 'header',
                props: { className: 'bg-primary text-white p-8 text-center' },
                children: [
                  {
                    type: 'h1',
                    props: { className: 'text-4xl mb-4' },
                    children: ['$t:home.welcome'],
                  },
                  {
                    type: 'p',
                    props: { className: 'text-xl' },
                    children: ['$t:home.description'],
                  },
                  {
                    type: 'a',
                    props: {
                      href: '/about',
                      className: 'inline-block mt-4 px-6 py-3 bg-white text-primary rounded',
                    },
                    children: ['$t:home.cta'],
                  },
                ],
              },
            ],
          },
          {
            name: 'about',
            path: '/about',
            meta: {
              title: '$t:about.title - $t:site.title',
            },
            sections: [
              {
                type: 'main',
                props: { className: 'container mx-auto p-8' },
                children: [
                  {
                    type: 'h1',
                    props: { className: 'text-3xl mb-4' },
                    children: ['$t:about.title'],
                  },
                  { type: 'p', children: ['$t:about.content'] },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: loading English version
      await page.goto(`file://${join(outputDir, 'en/index.html')}`)

      // THEN: should display English content
      await expect(page.locator('h1')).toHaveText('Welcome')
      await expect(page.locator('p').first()).toHaveText(
        'This site is available in multiple languages'
      )
      // THEN: assertion
      await expect(page.locator('a[href="/about"]')).toHaveText('Learn More')

      // Verify hreflang meta tags exist
      const enHreflangLinks = await page.locator('link[rel="alternate"][hreflang]').all()
      // THEN: assertion
      expect(enHreflangLinks.length).toBeGreaterThan(0)

      // Navigate to French version
      // WHEN: user navigates to the page
      await page.goto(`file://${join(outputDir, 'fr/index.html')}`)

      // Should display French content
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Bienvenue')
      await expect(page.locator('p').first()).toHaveText(
        'Ce site est disponible en plusieurs langues'
      )
      // THEN: assertion
      await expect(page.locator('a[href="/about"]')).toHaveText('En Savoir Plus')

      // Navigate to French about page
      // WHEN: user navigates to the page
      await page.goto(`file://${join(outputDir, 'fr/about.html')}`)
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('À Propos')
      await expect(page.locator('p')).toHaveText('Nous sommes une entreprise internationale')

      // Verify structure consistency
      const enFiles = await readdir(join(outputDir, 'en'))
      const frFiles = await readdir(join(outputDir, 'fr'))
      // THEN: assertion
      expect(enFiles).toEqual(frFiles) // Same files in both language directories
    }
  )
})
