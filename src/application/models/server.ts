/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Effect } from 'effect'
import type { Hono } from 'hono'

/**
 * Running server instance with stop capability
 *
 * This represents a domain concept of a running web server
 * that can be controlled (stopped) through Effect operations.
 *
 * The actual server implementation (Bun.serve) is hidden
 * behind this interface to maintain layer separation.
 *
 * The Hono app is exposed for static site generation (SSG) purposes.
 */
export interface ServerInstance {
  readonly server: ReturnType<typeof Bun.serve>
  readonly url: string
  readonly stop: Effect.Effect<void>
  readonly app: Readonly<Hono>
}
