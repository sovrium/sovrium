/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasGatedPage } from '@/domain/models/app/pages/page-search-corpus-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Context } from 'hono'

/**
 * Who a page search answers for — shared by the command palette's page half and
 * `GET /api/search/pages`, so both filter by the same reader.
 */

/** The router's own session reader — the one `checkPageAccess` is fed at render. */
export type PageReaderResolver = (headers: Headers) => Promise<SessionInfo | undefined>

/**
 * Resolve the reader a page search answers for. When no declared page is closed
 * to a visitor there is nothing a session could add, so no lookup is paid.
 */
export const resolvePageReader = async (
  c: Context,
  app: App,
  getSession: PageReaderResolver | undefined
): Promise<SessionInfo | undefined> =>
  getSession !== undefined && hasGatedPage(app) ? getSession(c.req.raw.headers) : undefined
