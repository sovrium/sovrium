/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { reportTransaction } from './error-reporter'
import type { MiddlewareHandler } from 'hono'

const STATIC_ASSET_EXT = /\.(css|js|mjs|map|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot)$/i

const isStaticAssetPath = (path: string): boolean =>
  path.startsWith('/assets/') || STATIC_ASSET_EXT.test(path)

export const createPerformanceMiddleware = (sampleRate: number): MiddlewareHandler => {
  return async (c, next) => {
    if (isStaticAssetPath(c.req.path) || Math.random() >= sampleRate) {
      return next()
    }
    const start = Date.now()
    await next()
    reportTransaction(`${c.req.method} ${c.req.path}`, start, Date.now())
  }
}
