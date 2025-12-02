/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { PageRenderer } from './page-renderer'
import type { App } from '@/domain/models/app'

describe('PageRenderer', () => {
  test('should be a Context.Tag', () => {
    // Verify PageRenderer is a valid Context.Tag
    expect(PageRenderer).toBeDefined()
    expect(typeof PageRenderer).toBe('function')
  })

  test('should have correct service identifier', () => {
    // Verify the tag has the expected identifier
    expect(String(PageRenderer)).toContain('PageRenderer')
  })

  test('should work with Effect dependency injection', async () => {
    // Create a mock implementation
    const mockApp: App = { name: 'test-app' }

    const MockPageRendererLive = Layer.succeed(PageRenderer, {
      renderHome: (app: App, _detectedLanguage?: string) => `<html>${app.name}</html>`,
      renderPage: (app: App, path: string, _detectedLanguage?: string) =>
        path === '/' ? `<html>${app.name}</html>` : undefined,
      renderNotFound: () => '<html>404</html>',
      renderError: () => '<html>500</html>',
    })

    // Test using the service via Effect
    const program = Effect.gen(function* () {
      const pageRenderer = yield* PageRenderer
      return {
        home: pageRenderer.renderHome(mockApp),
        page: pageRenderer.renderPage(mockApp, '/'),
        notFound: pageRenderer.renderNotFound(),
        error: pageRenderer.renderError(),
      }
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockPageRendererLive)))

    expect(result.home).toBe('<html>test-app</html>')
    expect(result.page).toBe('<html>test-app</html>')
    expect(result.notFound).toBe('<html>404</html>')
    expect(result.error).toBe('<html>500</html>')
  })

  test('renderPage should return undefined for non-existent paths', async () => {
    const mockApp: App = { name: 'test-app' }

    const MockPageRendererLive = Layer.succeed(PageRenderer, {
      renderHome: () => '<html>Home</html>',
      renderPage: (_app: App, path: string) => (path === '/' ? '<html>Home</html>' : undefined),
      renderNotFound: () => '<html>404</html>',
      renderError: () => '<html>500</html>',
    })

    const program = Effect.gen(function* () {
      const pageRenderer = yield* PageRenderer
      return pageRenderer.renderPage(mockApp, '/nonexistent')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockPageRendererLive)))
    expect(result).toBeUndefined()
  })
})
