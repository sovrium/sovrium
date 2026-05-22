/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ContentDir } from '@/domain/models/app/pages/content-dir'

export const matchesContentDirFilter = (
  filter: ContentDir['filter'],
  frontmatter: Readonly<Record<string, string>>
): boolean => {
  if (filter === undefined) return true
  return Object.entries(filter).every(([key, expected]) => {
    const actual = frontmatter[key]
    if (typeof expected === 'boolean') {
      const actualIsTrue = actual === 'true'
      return expected === actualIsTrue
    }
    return actual === String(expected)
  })
}
