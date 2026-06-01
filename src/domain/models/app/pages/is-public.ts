/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from './page'

export const isPublicPage = (page: Page): boolean => {
  const { access } = page
  if (access === undefined) return true
  if (access === 'all') return true
  if (typeof access === 'object' && !Array.isArray(access) && 'require' in access) {
    return access.require === 'all'
  }
  return false
}
