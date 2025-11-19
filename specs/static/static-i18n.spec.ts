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
      const outputDir = await generateStaticSite(
        {
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
                lang: '{{lang}}',
                title: '{{welcome.title}}',
                description: '{{welcome.description}}',
              },
              sections: [
                { type: 'h1', children: ['{{welcome.title}}'] },
                { type: 'p', children: ['{{welcome.description}}'] },
              ],
            },
            {
              name: 'about',
              path: '/about',
              meta: {
                lang: '{{lang}}',
                title: '{{about.title}}',
                description: '{{about.description}}',
              },
              sections: [
                { type: 'h1', children: ['{{about.title}}'] },
                { type: 'p', children: ['{{about.description}}'] },
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
              lang: '{{lang}}',
              title: '{{home.title}}',
              description: '{{home.content}}',
            },
            sections: [
              {
                type: 'main',
                props: { className: 'container' },
                children: [
                  { type: 'h1', children: ['{{home.heading}}'] },
                  { type: 'p', children: ['{{home.content}}'] },
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
      expect(enHtml).toContain('>Welcome to Our Site</h1>')
      expect(enHtml).toContain('>This is the English version</p>')

      // French version
      expect(frHtml).toContain('<!DOCTYPE html>')
      expect(frHtml).toContain('lang="fr-FR"')
      expect(frHtml).toContain('<title>Accueil</title>')
      expect(frHtml).toContain('content="Ceci est la version française"')
      expect(frHtml).toContain('>Bienvenue sur Notre Site</h1>')
      expect(frHtml).toContain('>Ceci est la version française</p>')

      // Default language at root
      const rootHtml = await readFile(join(outputDir, 'index.html'), 'utf-8')
      expect(rootHtml).toContain('Welcome to Our Site') // Default to English
    }
  )

  test.fixme(
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
              lang: '{{lang}}',
              title: '{{title}}',
            },
            sections: [],
          },
          {
            name: 'about',
            path: '/about',
            meta: {
              lang: '{{lang}}',
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
      // English home page should have links to other language versions
      expect(enHome).toContain(
        '<link rel="alternate" hreflang="en" href="https://example.com/en/">'
      )
      expect(enHome).toContain(
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr/">'
      )
      expect(enHome).toContain(
        '<link rel="alternate" hreflang="de" href="https://example.com/de/">'
      )
      expect(enHome).toContain(
        '<link rel="alternate" hreflang="x-default" href="https://example.com/">'
      )

      // French home page should have the same links
      expect(frHome).toContain(
        '<link rel="alternate" hreflang="en" href="https://example.com/en/">'
      )
      expect(frHome).toContain(
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr/">'
      )
      expect(frHome).toContain(
        '<link rel="alternate" hreflang="de" href="https://example.com/de/">'
      )

      // German home page
      expect(deHome).toContain(
        '<link rel="alternate" hreflang="en" href="https://example.com/en/">'
      )
      expect(deHome).toContain(
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr/">'
      )
      expect(deHome).toContain(
        '<link rel="alternate" hreflang="de" href="https://example.com/de/">'
      )

      // About page should have correct hreflang links
      expect(enAbout).toContain(
        '<link rel="alternate" hreflang="en" href="https://example.com/en/about">'
      )
      expect(enAbout).toContain(
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr/about">'
      )
      expect(enAbout).toContain(
        '<link rel="alternate" hreflang="de" href="https://example.com/de/about">'
      )

      // Canonical URL should be included
      expect(enHome).toContain('<link rel="canonical" href="https://example.com/en/">')
      expect(frHome).toContain('<link rel="canonical" href="https://example.com/fr/">')
      expect(enAbout).toContain('<link rel="canonical" href="https://example.com/en/about">')
    }
  )

  test.fixme(
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
            position: 'top',
            items: [
              { type: 'link', label: '{{nav.home}}', href: '/' },
              { type: 'link', label: '{{nav.about}}', href: '/about' },
            ],
            languageSwitcher: {
              label: '{{lang.switch}}',
              items: [
                { lang: 'en', label: '{{lang.en}}', href: '/en{{currentPath}}' },
                { lang: 'fr', label: '{{lang.fr}}', href: '/fr{{currentPath}}' },
                { lang: 'es', label: '{{lang.es}}', href: '/es{{currentPath}}' },
              ],
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: '{{lang}}', title: '{{nav.home}}' },
            sections: [],
          },
          {
            name: 'about',
            path: '/about',
            meta: { lang: '{{lang}}', title: '{{nav.about}}' },
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
      expect(enHome).toContain('<a href="/en/">English</a>')
      expect(enHome).toContain('<a href="/fr/">Français</a>')
      expect(enHome).toContain('<a href="/es/">Español</a>')

      // French home page
      expect(frHome).toContain('Langue') // Label in French
      expect(frHome).toContain('<a href="/en/">English</a>')
      expect(frHome).toContain('<a href="/fr/">Français</a>')
      expect(frHome).toContain('<a href="/es/">Español</a>')

      // Spanish about page - should link to about page in other languages
      expect(esAbout).toContain('Idioma') // Label in Spanish
      expect(esAbout).toContain('<a href="/en/about">English</a>')
      expect(esAbout).toContain('<a href="/fr/about">Français</a>')
      expect(esAbout).toContain('<a href="/es/about">Español</a>')

      // Navigation should be translated
      expect(enHome).toContain('Home')
      expect(enHome).toContain('About')
      expect(frHome).toContain('Accueil')
      expect(frHome).toContain('À propos')
      expect(esAbout).toContain('Inicio')
      expect(esAbout).toContain('Acerca de')
    }
  )

  test.fixme(
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
              lang: '{{lang}}',
              title: '{{home.welcome}} - {{site.title}}',
              description: '{{home.description}}',
            },
            sections: [
              {
                type: 'header',
                props: { className: 'bg-primary text-white p-8 text-center' },
                children: [
                  {
                    type: 'h1',
                    props: { className: 'text-4xl mb-4' },
                    children: ['{{home.welcome}}'],
                  },
                  {
                    type: 'p',
                    props: { className: 'text-xl' },
                    children: ['{{home.description}}'],
                  },
                  {
                    type: 'a',
                    props: {
                      href: '/about',
                      className: 'inline-block mt-4 px-6 py-3 bg-white text-primary rounded',
                    },
                    children: ['{{home.cta}}'],
                  },
                ],
              },
            ],
          },
          {
            name: 'about',
            path: '/about',
            meta: {
              lang: '{{lang}}',
              title: '{{about.title}} - {{site.title}}',
            },
            sections: [
              {
                type: 'main',
                props: { className: 'container mx-auto p-8' },
                children: [
                  {
                    type: 'h1',
                    props: { className: 'text-3xl mb-4' },
                    children: ['{{about.title}}'],
                  },
                  { type: 'p', children: ['{{about.content}}'] },
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
      await expect(page.locator('a[href="/about"]')).toHaveText('Learn More')

      // Verify hreflang meta tags exist
      const enHreflangLinks = await page.locator('link[rel="alternate"][hreflang]').all()
      expect(enHreflangLinks.length).toBeGreaterThan(0)

      // Navigate to French version
      await page.goto(`file://${join(outputDir, 'fr/index.html')}`)

      // Should display French content
      await expect(page.locator('h1')).toHaveText('Bienvenue')
      await expect(page.locator('p').first()).toHaveText(
        'Ce site est disponible en plusieurs langues'
      )
      await expect(page.locator('a[href="/about"]')).toHaveText('En Savoir Plus')

      // Navigate to French about page
      await page.goto(`file://${join(outputDir, 'fr/about.html')}`)
      await expect(page.locator('h1')).toHaveText('À Propos')
      await expect(page.locator('p')).toHaveText('Nous sommes une entreprise internationale')

      // Verify structure consistency
      const enFiles = await readdir(join(outputDir, 'en'))
      const frFiles = await readdir(join(outputDir, 'fr'))
      expect(enFiles).toEqual(frFiles) // Same files in both language directories
    }
  )
})
