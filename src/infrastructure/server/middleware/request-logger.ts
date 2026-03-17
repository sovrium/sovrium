/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { logDebug } from '@/infrastructure/logging/logger'
import type { MiddlewareHandler } from 'hono'

const EXCLUDED_PREFIXES = ['/assets/', '/favicon'] as const

/**
 * Request access log middleware
 *
 * Logs method, path, status, and duration for each request at debug level.
 * Static asset paths are excluded to reduce noise.
 *
 * Enable with LOG_LEVEL=debug or NODE_ENV=development.
 *
 * Format: `<-- GET / 200 12ms`
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  // eslint-disable-next-line functional/no-expression-statements
  await next()

  const { path } = c.req
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return

  const duration = Date.now() - start
  logDebug(`<-- ${c.req.method} ${path} ${c.res.status} ${duration}ms`)
}
