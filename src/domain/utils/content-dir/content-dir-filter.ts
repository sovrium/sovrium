/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared `contentDir.filter` predicate for the markdown-page-resolver
 * (per-route filter) and the content-dir lister (collection-nav filter).
 *
 * Both call sites apply the same boolean-coercion-against-string-frontmatter
 * semantics because frontmatter scalars are parsed by `splitFrontmatter` as
 * strings (the YAML splitter is intentionally string-only — see
 * `domain/services/markdown-renderer.ts`). A `draft: false` filter therefore
 * compares against the string `'true'` for the actual value.
 *
 * Pure: no I/O, no dependencies on infrastructure. Living in `domain/utils/`
 * keeps the single-source-of-truth co-located with the rest of the
 * frontmatter-shape semantics.
 */

import type { ContentDir } from '@/domain/models/app/pages/content-dir'

/**
 * Apply a `contentDir.filter` against the parsed frontmatter of a markdown
 * file. Returns `true` when the file should be rendered/listed, `false` when
 * it should be excluded.
 *
 * Honours boolean filters (`draft: false` excludes files whose frontmatter
 * has `draft: true`) and falls through to string-equality comparison for
 * other shapes (the splitter already coerces all scalars to strings).
 */
export const matchesContentDirFilter = (
  filter: ContentDir['filter'],
  frontmatter: Readonly<Record<string, string>>
): boolean => {
  if (filter === undefined) return true
  return Object.entries(filter).every(([key, expected]) => {
    const actual = frontmatter[key]
    if (typeof expected === 'boolean') {
      // `draft: false` filter excludes files whose frontmatter parsed `draft`
      // as the string `'true'`. Strings other than `'true'` are treated as
      // not-true (safe default for `draft: false` exclusion semantics).
      const actualIsTrue = actual === 'true'
      return expected === actualIsTrue
    }
    return actual === String(expected)
  })
}
