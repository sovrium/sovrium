/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ContentDir } from '@/domain/models/app/pages/content-dir'

const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

export const deriveContentDirSlugFromRouteParams = (
  contentDir: ContentDir,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  const values = Object.entries(routeParams)
    .filter(([key, value]) => key !== 'lang' && typeof value === 'string' && value.length > 0)
    .map(([, value]) => value)
  if (values.length === 0) return undefined
  if (contentDir.slugFrom === 'filepath') return stripLeadingSlash(values.join('/'))
  const first = values[0]
  return first === undefined ? undefined : stripLeadingSlash(first)
}
