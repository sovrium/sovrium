/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { ServerFactory, type ServerFactoryConfig } from './server-factory'
import type { ServerInstance } from '@/application/models/server'
import type { App } from '@/domain/models/app'

describe('ServerFactory', () => {
  test('should be a Context.Tag', () => {
    expect(ServerFactory).toBeDefined()
    expect(typeof ServerFactory).toBe('function')
  })

  test('should have correct service identifier', () => {
    // Verify the tag has the expected identifier
    expect(String(ServerFactory)).toContain('ServerFactory')
  })

  test('should create server instance successfully', async () => {
    const mockServerInstance: Partial<ServerInstance> = {
      url: 'http://localhost:3000',
      stop: Effect.succeed(undefined),
    }

    const MockServerFactoryLive = Layer.succeed(ServerFactory, {
      create: (_config: ServerFactoryConfig) =>
        Effect.succeed(mockServerInstance as ServerInstance),
    })

    const mockConfig: ServerFactoryConfig = {
      app: { name: 'test-app' },
      port: 3000,
      hostname: 'localhost',
      renderHomePage: () => '<html>Home</html>',
      renderPage: () => '<html>Page</html>',
      renderNotFoundPage: () => '<html>404</html>',
      renderErrorPage: () => '<html>500</html>',
    }

    const program = Effect.gen(function* () {
      const serverFactory = yield* ServerFactory
      return yield* serverFactory.create(mockConfig)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockServerFactoryLive)))

    expect(result.url).toBe('http://localhost:3000')
  })
})

describe('ServerFactoryConfig interface', () => {
  test('should have required fields', () => {
    const mockApp: App = { name: 'test-app' }

    const config: ServerFactoryConfig = {
      app: mockApp,
      renderHomePage: (app: App) => `<html>${app.name}</html>`,
      renderPage: (app: App, path: string) => `<html>${app.name} - ${path}</html>`,
      renderNotFoundPage: () => '<html>404</html>',
      renderErrorPage: () => '<html>500</html>',
    }

    expect(config.app).toBe(mockApp)
    expect(config.renderHomePage(mockApp)).toBe('<html>test-app</html>')
    expect(config.renderPage(mockApp, '/about')).toBe('<html>test-app - /about</html>')
    expect(config.renderNotFoundPage()).toBe('<html>404</html>')
    expect(config.renderErrorPage()).toBe('<html>500</html>')
  })

  test('should have optional port and hostname', () => {
    const config: ServerFactoryConfig = {
      app: { name: 'test-app' },
      port: 8080,
      hostname: '0.0.0.0',
      renderHomePage: () => '<html>Home</html>',
      renderPage: () => '<html>Page</html>',
      renderNotFoundPage: () => '<html>404</html>',
      renderErrorPage: () => '<html>500</html>',
    }

    expect(config.port).toBe(8080)
    expect(config.hostname).toBe('0.0.0.0')
  })

  test('port and hostname should be optional', () => {
    const config: ServerFactoryConfig = {
      app: { name: 'test-app' },
      renderHomePage: () => '<html>Home</html>',
      renderPage: () => '<html>Page</html>',
      renderNotFoundPage: () => '<html>404</html>',
      renderErrorPage: () => '<html>500</html>',
    }

    expect(config.port).toBeUndefined()
    expect(config.hostname).toBeUndefined()
  })
})
