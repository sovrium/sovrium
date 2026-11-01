/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The optional entry fields a content article declares in its own front
 * matter, read by the content-directory enumerator: its last edit date and its
 * reader access. Each overlay is spread into an entry, so a field the front
 * matter does not declare is absent rather than `undefined`.
 */

import { frontmatterAccess } from '@/domain/models/app/pages/content-dir-access'
import type { ContentDirEntry } from '@/application/ports/services/content-dir-reader'

type FrontMatter = Readonly<Record<string, string>>

/**
 * The front matter keys an article declares its last edit under, in the order
 * they are read: the first one present wins.
 */
const LASTMOD_KEYS = ['updated', 'lastmod', 'dateModified'] as const

/**
 * The `lastmod` overlay of one entry: the date its front matter declares, raw.
 * Never the file's modification time, which a checkout or a deploy rewrites
 * without the article changing.
 */
export const lastmodOverlay = (frontmatter: FrontMatter): Pick<ContentDirEntry, 'lastmod'> => {
  const lastmod = LASTMOD_KEYS.map((key) => frontmatter[key]).find(
    (value) => value !== undefined && value !== ''
  )
  return lastmod === undefined ? {} : { lastmod }
}

/** The `access` overlay of one entry: its front matter's, when it declares one. */
export const accessOverlay = (frontmatter: FrontMatter): Pick<ContentDirEntry, 'access'> => {
  const access = frontmatterAccess(frontmatter)
  return access === undefined ? {} : { access }
}
