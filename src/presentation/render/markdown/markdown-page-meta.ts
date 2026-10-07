/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { buildContentDirEditUrl } from '@/domain/models/app/pages/content-dir-edit-url'
import { deriveContentDirSlugFromRouteParams } from '@/domain/models/app/pages/content-dir-slug'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import {
  resolveDocsRootCrumb,
  type DocsRootCrumb,
} from '@/presentation/render/markdown/docs-root-crumb'
import { getContentBaseDir } from '@/presentation/render/resolve/content-base-dir'
import { type CollectionNavData } from '@/presentation/render/resolve/content-dir-lister'
import { derivePageSourceFile } from './markdown-page-source'
import type { Page } from '@/domain/models/app/pages'

/**
 * The per-page metadata a docs article prints around its body: the last-updated
 * date, the edit and issue links, and the root crumb of its breadcrumb.
 */

/**
 * Whether a value is a bare calendar date rather than an instant: a
 * `YYYY-MM-DD` string, or the UTC-midnight `Date` a YAML parser makes of one.
 */
const isCalendarDate = (input: string | Date, date: Readonly<Date>): boolean =>
  typeof input === 'string'
    ? /^\d{4}-\d{2}-\d{2}$/.test(input)
    : date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 &&
      date.getUTCMilliseconds() === 0

/**
 * Format a date (ISO string or `Date`) as a human long-form stamp localized to
 * `lang` (e.g. `July 11, 2026` for `en`, `11 juillet 2026` for `fr`). Defaults
 * to English when no locale is active, and falls back to English on a malformed
 * locale tag (a `RangeError` from `Intl.DateTimeFormat`). Returns `undefined`
 * for an unparseable input.
 *
 * An INSTANT (a file's modification time, a full timestamp) renders on the
 * operator timezone's calendar (`SOVRIUM_TIMEZONE`, UTC when unset), never the
 * host's. A bare calendar DATE renders as written, in UTC: it names a day, not
 * a moment, and shifting it into a zone west of Greenwich would print the day
 * before the author's.
 */
const formatHumanDate = (input: string | Date, lang?: string): string | undefined => {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return undefined
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: isCalendarDate(input, date) ? 'UTC' : parseSovriumTimezone().zoneId,
  }
  try {
    return new Intl.DateTimeFormat(lang ?? 'en', options).format(date)
  } catch {
    // Malformed locale tag (RangeError) — fall back to the default English form.
    return new Intl.DateTimeFormat('en', options).format(date)
  }
}

/**
 * Read the modification time of a content file, resolved against the same
 * content base-dir anchor as {@link readMarkdownFile}. Returns `undefined` on
 * any I/O failure (the last-updated stamp then simply does not render).
 */
const statMtime = async (path: string): Promise<Date | undefined> => {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(getContentBaseDir(), path)
    const stats = await stat(absolutePath)
    return stats.mtime
  } catch {
    return undefined
  }
}

/**
 * Resolve the on-disk content-file path for the last-updated mtime fallback.
 * Mirrors the source-selection order the resolver uses: a `contentDir` file
 * (`${directory}/${slug}.md`) first, then `markdown.file`, then the page-level
 * `source.file`. Returns `undefined` for inline `markdown.content` (no file).
 */
const resolveContentFilePath = (
  page: Page,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  const { contentDir } = page
  if (contentDir !== undefined) {
    const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
    if (slug === undefined) return undefined
    const directory = contentDir.directory.replace(/\/+$/, '')
    return `${directory}/${slug}.md`
  }
  if (typeof page.markdown?.file === 'string') return page.markdown.file
  return derivePageSourceFile(page)
}

/**
 * Resolve the article's "Last updated" stamp.
 * The stamp is a `docs`-layout affordance only, so non-`docs` layouts short-
 * circuit before the mtime `stat`. An explicit `updated` (or `date`) frontmatter
 * field WINS (a no-maintenance, honest override); otherwise it falls back to the
 * content file's modification time read at serve time. Returns `undefined` when
 * the layout is not `docs`, or when neither a frontmatter date nor an mtime is
 * available.
 */
// eslint-disable-next-line max-params -- the active currentLang is threaded through the last-updated resolver
export async function resolveLastUpdated(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  layout: 'prose' | 'docs' | 'full' | 'none',
  currentLang?: string
): Promise<string | undefined> {
  if (layout !== 'docs') return undefined
  const frontmatterDate = frontmatter['updated'] ?? frontmatter['date']
  if (typeof frontmatterDate === 'string' && frontmatterDate.trim().length > 0) {
    return formatHumanDate(frontmatterDate.trim(), currentLang)
  }
  const filePath = resolveContentFilePath(page, routeParams)
  if (filePath === undefined) return undefined
  const mtime = await statMtime(filePath)
  return mtime === undefined ? undefined : formatHumanDate(mtime, currentLang)
}

/**
 * Resolve the article's "Edit this page" href.
 * Returns `undefined` unless the page's `contentDir.editUrl` template is set AND
 * the article slug resolves — the two conditions that make an honest edit target.
 * The `{slug}` / `{path}` / `{lang}` placeholders are interpolated from the
 * derived slug and the active `currentLang` (NOT from any nav href, whose pattern
 * carries no `/:lang/` prefix).
 */
export const resolveEditUrl = (
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  currentLang: string | undefined
): string | undefined => {
  const { contentDir } = page
  if (contentDir?.editUrl === undefined) return undefined
  const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  if (slug === undefined) return undefined
  return buildContentDirEditUrl({ template: contentDir.editUrl, slug, lang: currentLang })
}

/**
 * Resolve the article's "Report an issue" href (A2). Mirrors {@link resolveEditUrl}
 * — the SAME `buildContentDirEditUrl` interpolation — but reads `contentDir.issueUrl`,
 * whose placeholders are OPTIONAL (a bare tracker URL passes through verbatim).
 * Returns `undefined` unless the template is set AND the slug resolves.
 */
export const resolveIssueUrl = (
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  currentLang: string | undefined
): string | undefined => {
  const { contentDir } = page
  if (contentDir?.issueUrl === undefined) return undefined
  const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  if (slug === undefined) return undefined
  return buildContentDirEditUrl({ template: contentDir.issueUrl, slug, lang: currentLang })
}

/**
 * Resolve the docs-article breadcrumb ROOT crumb (A1) from an already-built
 * collection nav. Returns `undefined` for a non-zoned sidebar (the breadcrumb then
 * keeps its "Home" root). The active entry is the sidebar's `isCurrent` entry.
 */
export const buildDocsRootCrumb = (
  collectionNav: CollectionNavData | undefined
): DocsRootCrumb | undefined => {
  if (collectionNav === undefined) return undefined
  const current = collectionNav.sidebar.find((entry) => entry.isCurrent)
  if (current === undefined) return undefined
  return resolveDocsRootCrumb(collectionNav.sidebar, current, collectionNav.tabs)
}
