/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Server Infrastructure Module
 *
 * Provides HTTP server creation, lifecycle management, and factory implementations.
 * Uses Hono web framework with graceful shutdown support.
 *
 * @example
 * ```typescript
 * import { ServerFactoryLive } from '@/infrastructure/server'
 *
 * const program = startServer(config).pipe(
 *   Effect.provide(ServerFactoryLive)
 * )
 * ```
 */

export { createServer } from './server'
export { withGracefulShutdown } from './lifecycle'
export { ServerFactoryLive } from './server-factory-live'
