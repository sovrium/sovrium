/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { redactSecretPath } from '@/domain/kernel/url/secret-path-redaction'
import { internalErrorLogSuffix } from '@/infrastructure/logging/internal-error-report'
import { logError } from '@/infrastructure/logging/logger'
import type { Context } from 'hono'

/**
 * Status served by the rendered error page, declared once and interpolated
 * into BOTH the log line and the response so the two can never drift.
 */
const ERROR_PAGE_STATUS = 500

/**
 * The answer a page or console render that failed inside its route's own
 * `catch` gives: the error page naming the request id, with the failure kept
 * under that id and logged exactly as the server's last-resort error boundary
 * does for an uncaught throw. So every `500` page can be quoted, and reported
 * (or told its fix) from the id it names.
 *
 * `renderErrorPage` receives the id; the route keeps its own app and language.
 */
export const answerRenderFailure = async (
  c: Context,
  error: unknown,
  renderErrorPage: (requestId: string | undefined) => string | Promise<string>
): Promise<Response> => {
  const id: unknown = c.get('requestId')
  const requestId = typeof id === 'string' ? id : undefined
  logError(
    `[server] ${c.req.method} ${redactSecretPath(c.req.path)} → ${ERROR_PAGE_STATUS}${internalErrorLogSuffix(error, requestId)}`,
    error
  )
  return c.html(await renderErrorPage(requestId), ERROR_PAGE_STATUS)
}
