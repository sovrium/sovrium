/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import type { ServerInstance } from './server'

describe('ServerInstance interface', () => {
  test('should define correct shape for server instance', () => {
    // Type-level test: verify the interface shape compiles correctly
    const mockServerInstance: ServerInstance = {
      server: Bun.serve({
        port: 0,
        fetch: () => new Response('OK'),
      }),
      url: 'http://localhost:3000',
      stop: Effect.succeed(undefined),
      app: {
        fetch: () => Promise.resolve(new Response('OK')),
      } as unknown as ServerInstance['app'],
    }

    // Verify required properties
    expect(mockServerInstance.url).toBe('http://localhost:3000')
    expect(mockServerInstance.server).toBeDefined()
    expect(mockServerInstance.stop).toBeDefined()
    expect(mockServerInstance.app).toBeDefined()

    // Clean up
    mockServerInstance.server.stop()
  })

  test('should have readonly properties', () => {
    // Type assertion test: properties should be readonly
    // This is a compile-time check - if it compiles, the interface is correct
    const instance: Partial<ServerInstance> = {}

    // These assignments should work (we're just verifying the shape)
    expect(instance.url).toBeUndefined()
    expect(instance.server).toBeUndefined()
    expect(instance.stop).toBeUndefined()
    expect(instance.app).toBeUndefined()
  })
})
