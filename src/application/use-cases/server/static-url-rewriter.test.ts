/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { isGitHubPagesUrl, rewriteUrlsWithBasePath } from './static-url-rewriter'

describe('isGitHubPagesUrl', () => {
  describe('When URL is a GitHub Pages URL', () => {
    test('Then returns true for exact github.io', () => {
      expect(isGitHubPagesUrl('https://github.io')).toBe(true)
    })

    test('Then returns true for subdomain.github.io', () => {
      expect(isGitHubPagesUrl('https://username.github.io')).toBe(true)
    })

    test('Then returns true for subdomain.github.io with path', () => {
      expect(isGitHubPagesUrl('https://username.github.io/repo')).toBe(true)
    })

    test('Then returns true for nested subdomain.github.io', () => {
      expect(isGitHubPagesUrl('https://org.user.github.io/project')).toBe(true)
    })
  })

  describe('When URL is not a GitHub Pages URL', () => {
    test('Then returns false for other domains', () => {
      expect(isGitHubPagesUrl('https://example.com')).toBe(false)
    })

    test('Then returns false for GitHub main site', () => {
      expect(isGitHubPagesUrl('https://github.com')).toBe(false)
    })

    test('Then returns false for domain containing github.io as substring', () => {
      // Security test: avoid substring matching vulnerability
      expect(isGitHubPagesUrl('https://notgithub.io.example.com')).toBe(false)
    })

    test('Then returns false for similar domain names', () => {
      expect(isGitHubPagesUrl('https://fakegithub.io.malicious.com')).toBe(false)
    })
  })

  describe('When URL is invalid', () => {
    test('Then returns false for empty string', () => {
      expect(isGitHubPagesUrl('')).toBe(false)
    })

    test('Then returns false for malformed URL', () => {
      expect(isGitHubPagesUrl('not-a-url')).toBe(false)
    })

    test('Then returns false for relative path', () => {
      expect(isGitHubPagesUrl('/path/to/page')).toBe(false)
    })
  })
})

describe('rewriteUrlsWithBasePath', () => {
  describe('When rewriting href attributes', () => {
    test('Then rewrites root-relative href', () => {
      const html = '<a href="/about">About</a>'
      const result = rewriteUrlsWithBasePath(html, '/my-app')
      expect(result).toBe('<a href="/my-app/about">About</a>')
    })

    test('Then rewrites multiple href attributes', () => {
      const html = '<a href="/about">About</a><a href="/contact">Contact</a>'
      const result = rewriteUrlsWithBasePath(html, '/my-app')
      expect(result).toBe('<a href="/my-app/about">About</a><a href="/my-app/contact">Contact</a>')
    })

    test('Then does not rewrite external URLs', () => {
      const html = '<a href="https://external.com">External</a>'
      const result = rewriteUrlsWithBasePath(html, '/my-app')
      expect(result).toBe('<a href="https://external.com">External</a>')
    })

    test('Then handles trailing slash in basePath', () => {
      const html = '<a href="/about">About</a>'
      const result = rewriteUrlsWithBasePath(html, '/my-app/')
      expect(result).toBe('<a href="/my-app/about">About</a>')
    })
  })

  describe('When rewriting src attributes', () => {
    test('Then rewrites root-relative src', () => {
      const html = '<img src="/images/logo.png">'
      const result = rewriteUrlsWithBasePath(html, '/my-app')
      expect(result).toBe('<img src="/my-app/images/logo.png">')
    })

    test('Then rewrites script src', () => {
      const html = '<script src="/scripts/main.js"></script>'
      const result = rewriteUrlsWithBasePath(html, '/my-app')
      expect(result).toBe('<script src="/my-app/scripts/main.js"></script>')
    })
  })

  describe('When handling /assets/ paths', () => {
    test('Then uses base path without language for assets href', () => {
      const html = '<link href="/assets/styles.css">'
      const result = rewriteUrlsWithBasePath(html, '/my-app/en')
      expect(result).toBe('<link href="/my-app/assets/styles.css">')
    })

    test('Then uses base path without language for assets src', () => {
      const html = '<script src="/assets/client.js"></script>'
      const result = rewriteUrlsWithBasePath(html, '/my-app/fr')
      expect(result).toBe('<script src="/my-app/assets/client.js"></script>')
    })

    test('Then rewrites non-assets paths with full basePath including language', () => {
      const html = '<a href="/about">About</a>'
      const result = rewriteUrlsWithBasePath(html, '/my-app/en')
      expect(result).toBe('<a href="/my-app/en/about">About</a>')
    })
  })

  describe('When handling hreflang links', () => {
    test('Then rewrites hreflang URLs with full baseUrl', () => {
      const html = '<link hreflang="en" href="/en/">'
      const result = rewriteUrlsWithBasePath(html, '/my-app', 'https://example.com/my-app')
      expect(result).toBe('<link hreflang="en" href="https://example.com/my-app/en/">')
    })

    test('Then normalizes hrefLang to hreflang', () => {
      const html = '<link hrefLang="en-US" href="/en/">'
      const result = rewriteUrlsWithBasePath(html, '/my-app', 'https://example.com/my-app')
      expect(result).toBe('<link hreflang="en" href="https://example.com/my-app/en/">')
    })

    test('Then extracts short language code from full locale', () => {
      const html = '<link hreflang="fr-FR" href="/fr/">'
      const result = rewriteUrlsWithBasePath(html, '/my-app', 'https://example.com/my-app')
      expect(result).toBe('<link hreflang="fr" href="https://example.com/my-app/fr/">')
    })
  })

  describe('When adding canonical link', () => {
    test('Then adds canonical link when missing and baseUrl provided', () => {
      const html = '<head><title>Page</title></head>'
      const result = rewriteUrlsWithBasePath(
        html,
        '/my-app',
        'https://example.com/my-app',
        '/about'
      )
      expect(result).toContain('rel="canonical"')
      expect(result).toContain('href="https://example.com/my-app/about"')
    })

    test('Then does not add canonical if already present', () => {
      const html = '<head><link rel="canonical" href="https://existing.com"></head>'
      const result = rewriteUrlsWithBasePath(
        html,
        '/my-app',
        'https://example.com/my-app',
        '/about'
      )
      expect(result).toBe('<head><link rel="canonical" href="https://existing.com"></head>')
    })

    test('Then handles root page path', () => {
      const html = '<head><title>Home</title></head>'
      const result = rewriteUrlsWithBasePath(html, '/my-app', 'https://example.com/my-app', '/')
      expect(result).toContain('href="https://example.com/my-app/"')
    })

    test('Then removes trailing slash from baseUrl', () => {
      const html = '<head><title>Page</title></head>'
      const result = rewriteUrlsWithBasePath(
        html,
        '/my-app',
        'https://example.com/my-app/',
        '/page'
      )
      expect(result).toContain('href="https://example.com/my-app/page"')
    })

    test('Then does not add canonical when baseUrl is undefined', () => {
      const html = '<head><title>Page</title></head>'
      const result = rewriteUrlsWithBasePath(html, '/my-app', undefined, '/about')
      expect(result).not.toContain('rel="canonical"')
    })

    test('Then does not add canonical when pagePath is undefined', () => {
      const html = '<head><title>Page</title></head>'
      const result = rewriteUrlsWithBasePath(html, '/my-app', 'https://example.com/my-app')
      expect(result).not.toContain('rel="canonical"')
    })
  })

  describe('When combining multiple rewrites', () => {
    test('Then handles complex HTML with multiple URL types', () => {
      const html = `
        <head>
          <link href="/assets/styles.css">
          <title>Test</title>
        </head>
        <body>
          <a href="/about">About</a>
          <img src="/assets/logo.png">
          <script src="/scripts/app.js"></script>
        </body>
      `
      const result = rewriteUrlsWithBasePath(html, '/my-app/en', 'https://example.com/my-app')

      // Assets should use base path without language
      expect(result).toContain('href="/my-app/assets/styles.css"')
      expect(result).toContain('src="/my-app/assets/logo.png"')

      // Non-assets should include language prefix
      expect(result).toContain('href="/my-app/en/about"')
      expect(result).toContain('src="/my-app/en/scripts/app.js"')
    })
  })
})
