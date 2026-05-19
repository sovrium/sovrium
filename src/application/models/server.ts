/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Effect } from 'effect'
import type { Hono } from 'hono'

export interface ServerInstance {
  readonly server: ReturnType<typeof Bun.serve>
  readonly url: string
  readonly stop: Effect.Effect<void>
  readonly app: Readonly<Hono>
}
