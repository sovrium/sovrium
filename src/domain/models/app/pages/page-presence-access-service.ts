/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { checkPageAccess } from '@/domain/models/app/pages/page-access-check'
import {
  findDeclaredPage,
  type DeclaredPageMatch,
} from '@/domain/models/app/pages/page-path-resolvability'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * The page a presence channel belongs to, when the caller may be on it.
 *
 * Presence is « who else is viewing the same page », so it exists only where
 * three things hold at once: `pagePath` is a declared page, that page declares
 * `presence: true`, and its `access` admits the caller — the same decision a
 * visit to the page is judged on. Anything else — a page she may not open, a
 * page without presence, a path that is no page — answers `undefined`, and the
 * caller makes that one uniform refusal, naming nobody.
 *
 * Returns the match (page and route parameters) so a further check — such as
 * whether the caller may read the record a parameterised page shows — can be
 * made on the same resolution.
 */
export function resolvePresencePage(
  app: App,
  pagePath: string,
  session: SessionInfo | undefined
): DeclaredPageMatch | undefined {
  const match = findDeclaredPage(app, pagePath)
  if (match === undefined || match.page.presence !== true) return undefined
  return checkPageAccess(match.page.access, app, session, pagePath).allowed ? match : undefined
}
