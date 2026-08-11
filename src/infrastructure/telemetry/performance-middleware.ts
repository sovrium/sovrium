/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Hono timing middleware that emits sampled Sentry performance transactions
 *.
 *
 * Registered in the server assembly ONLY when `SENTRY_DSN` is set and
 * `SENTRY_TRACES_SAMPLE_RATE` is in `(0,1]`. Each request is timed; with
 * probability equal to the sample rate a transaction envelope (`METHOD /path`,
 * `op: http.server`) is POSTed fire-and-forget. Static-asset paths are excluded
 * so pixel/JS/CSS traffic doesn't dominate the sample.
 */

import { reportTransaction } from './error-reporter'
import type { MiddlewareHandler } from 'hono'

/** Static-asset file extensions excluded from performance sampling. */
const STATIC_ASSET_EXT = /\.(css|js|mjs|map|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot)$/i

/** Whether a request path is a static asset (excluded from sampling). */
const isStaticAssetPath = (path: string): boolean =>
  path.startsWith('/assets/') || STATIC_ASSET_EXT.test(path)

/**
 * Build the performance timing middleware for a given sample rate. Times each
 * non-asset request and emits a transaction with probability `sampleRate`.
 */
export const createPerformanceMiddleware = (sampleRate: number): MiddlewareHandler => {
  return async (c, next) => {
    if (isStaticAssetPath(c.req.path) || Math.random() >= sampleRate) {
      return next()
    }
    const start = Date.now()
    // eslint-disable-next-line functional/no-expression-statements -- await downstream handling before timing
    await next()
    reportTransaction(`${c.req.method} ${c.req.path}`, start, Date.now())
  }
}
