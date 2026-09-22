/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isOpenToEveryone, toPermissionValue } from '@/domain/models/app/auth/permission-evaluation'
import type { Page } from './page'

/**
 * Returns true when the page is anonymously readable.
 *
 * A page is public when:
 * - `access` is missing (default = public), OR
 * - `access === 'all'`, OR
 * - `access` is the extended object form with `require: 'all'`.
 *
 * All other shapes (`'authenticated'`, role arrays `['admin']`, or
 * `{ require: 'authenticated', redirectTo }`) are NOT public.
 *
 * Used by:
 * - `static-language-generators.ts` to skip auth pages in static HTML emission.
 * - The forthcoming Pagefind-equivalent search indexer to skip auth pages
 *   in the client-side search index.
 */
export const isPublicPage = (page: Page): boolean => {
  const { access } = page
  if (access === undefined) return true
  if (typeof access === 'object' && !Array.isArray(access) && 'require' in access) {
    return isOpenToEveryone(access.require)
  }
  return isOpenToEveryone(toPermissionValue(access))
}
