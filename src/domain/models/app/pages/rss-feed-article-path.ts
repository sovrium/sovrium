/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import {
  deriveContentDirIndexBasePath,
  deriveTrailingDynamicParamName,
} from './content-dir-index-base-path'
import type { Page } from '@/domain/models/app/pages'

/** The slug a contentDir derives for `file`: its name, or its path under the folder. */
const articleSlugOf = (file: string, directory: string, slugFrom: string | undefined): string => {
  const withoutExtension = file.replace(/\.mdx?$/i, '')
  if (slugFrom === 'filepath') {
    const folder = `${directory.replace(/^\.\//, '').replace(/\/$/, '')}/`
    const relative = withoutExtension.replace(/^\.\//, '')
    return relative.startsWith(folder) ? relative.slice(folder.length) : relative
  }
  return withoutExtension.slice(withoutExtension.lastIndexOf('/') + 1)
}

/**
 * The address of the page a markdown feed's items link to.
 *
 * A page with no folder of articles is served at its own path. A `contentDir`
 * page is a pattern (`/en/changelog/:slug`), and its `markdown.file` is one
 * article of the folder: the items link to THAT article's address, the slug
 * filled in, and the `index` article's to the bare path the server answers it
 * on (`/en/changelog`). A literal `:slug` would name an address that does not
 * exist.
 */
export const markdownFeedArticlePath = (page: Page): string => {
  const { contentDir } = page
  const file = page.markdown?.file
  const path = primaryPagePath(page.path)
  const param = deriveTrailingDynamicParamName(path)
  if (contentDir === undefined || typeof file !== 'string' || param === undefined) {
    return path
  }
  const slug = articleSlugOf(file, contentDir.directory, contentDir.slugFrom)
  if (slug === contentDir.index) return deriveContentDirIndexBasePath(path) ?? path
  // A replacer function: a slug is file text, and `$&` in it must stay literal.
  return path.replace(/:[^/]+?\*?$/, () => slug)
}
