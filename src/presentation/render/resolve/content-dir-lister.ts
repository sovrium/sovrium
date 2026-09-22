/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content-directory navigation lister.
 *
 * Reads the markdown files under `contentDir.directory` through the shared,
 * stat-revalidated corpus cache in `infrastructure/markdown/content-dir-enumerator`
 * (which globs + parses frontmatter once instead of per render), then applies
 * the same `filter`/`sort` semantics the markdown-page-resolver uses for
 * individual route resolution. Returns:
 *
 *   - `sidebar`: an ordered list of entries (optionally grouped by a
 *     frontmatter field) backing the `DocsSidebarNav` SSR component.
 *   - `previous` / `next`: the entries immediately before and after the
 *     currently-rendered slug in the sorted order, backing `DocsPrevNext`.
 *
 * Lives in the presentation layer because file I/O is a side effect — the
 * pure renderer in `domain/services/markdown-renderer.ts` is intentionally
 * I/O-free. Mirrors the layering rationale documented at the top of
 * `markdown-page-resolver.ts`.
 */

import { matchesContentDirFilter } from '@/domain/models/app/pages/content-dir-filter'
import { deriveContentDirIndexBasePath } from '@/domain/models/app/pages/content-dir-index-base-path'
import { loadContentDirCorpus } from '@/infrastructure/markdown/content-dir-enumerator'
import { humanizeFieldName } from '@/presentation/design/string-utils'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'

/**
 * Single sidebar entry. `group` is undefined when `contentDir.nav.groupBy` is
 * unset (no grouping → entries render in a flat list).
 */
export interface CollectionNavEntry {
  readonly slug: string
  readonly href: string
  readonly label: string
  /** Raw `groupBy` frontmatter value used to bucket entries (undefined = ungrouped). */
  readonly group: string | undefined
  /**
   * Display label for the entry's group section, resolved at list time:
   * `nav.groupLabels[group]` when present, else the raw key humanized to
   * Title Case ("get-started" → "Get Started"). Undefined when ungrouped.
   */
  readonly groupLabel: string | undefined
  /**
   * Lucide icon name for the entry's group section, resolved at list time from
   * `nav.groupIcons[group]`. Undefined when ungrouped, unmapped, or no icons
   * are configured — the sidebar then renders the group label-only.
   */
  readonly groupIcon: string | undefined
  readonly order: number | undefined
  readonly isCurrent: boolean
}

/** Prev/next adjacent entry surfaced to `DocsPrevNext`. */
export interface CollectionPrevNext {
  readonly href: string
  readonly label: string
}

/**
 * The collection's declared docs navigation tabs (zones), straight from
 * `contentDir.nav.tabs`. Collection-level,
 * so they ride on {@link CollectionNavData} rather than on each entry.
 *
 * Sourced from the schema type so the presentation layer never re-declares the
 * shape: an app's docs information architecture lives in its config, and the
 * engine ships none of its own.
 */
export type CollectionNavTabs = NonNullable<NonNullable<ContentDir['nav']>['tabs']>

/**
 * Payload attached to `ResolvedMarkdownPage` when `contentDir.nav.enabled` is
 * truthy. Consumed by `DocsSidebarNav` (sidebar) + `DocsPrevNext` (article
 * footer chrome) in the `docs` layout.
 */
export interface CollectionNavData {
  readonly sidebar: readonly CollectionNavEntry[]
  readonly previous: CollectionPrevNext | undefined
  readonly next: CollectionPrevNext | undefined
  /**
   * Whether sidebar group sections render collapsed by default (only the active
   * group `open`). Mirrors `contentDir.nav.collapsed`; defaults to `false`.
   */
  readonly collapsed: boolean
  /**
   * The app's declared docs tabs (zones), mirroring `contentDir.nav.tabs`.
   * Undefined when the collection declares no tab IA — the sidebar then renders
   * the flat expanded stack with no zone announcement, and the docs-article
   * breadcrumb keeps its "Home" root (tabs are opt-in per collection).
   */
  readonly tabs: CollectionNavTabs | undefined
}

/**
 * Parsed file record before filtering/sorting. Internal to this module.
 */
interface ContentDirFile {
  readonly slug: string
  readonly frontmatter: Readonly<Record<string, string>>
}

const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

/** Strip trailing `/` from `contentDir.directory` (defensive). */
const normaliseDirectory = (directory: string): string => directory.replace(/\/+$/, '')

/**
 * Convert a relative markdown filepath (e.g. `guides/setup.md`) into the slug
 * portion the route uses (e.g. `guides/setup`). The dirname segments are kept
 * so nested files map to nested URLs under the wildcard route.
 */
const filePathToSlug = (relativePath: string): string =>
  stripLeadingSlash(relativePath).replace(/\.md$/i, '')

/**
 * Sort comparator backing `contentDir.sort`. Numeric fields (like `order`)
 * sort numerically when both values parse as finite numbers; otherwise we
 * fall back to a lexical compare so string fields (eg. `date`) still order
 * deterministically.
 */
const compareByField = (
  field: string,
  direction: 'asc' | 'desc',
  a: ContentDirFile,
  b: ContentDirFile
): number => {
  const av = a.frontmatter[field] ?? ''
  const bv = b.frontmatter[field] ?? ''
  const an = Number(av)
  const bn = Number(bv)
  const numeric = Number.isFinite(an) && Number.isFinite(bn) && av !== '' && bv !== ''
  const diff = numeric ? an - bn : av.localeCompare(bv)
  return direction === 'asc' ? diff : -diff
}

/**
 * Apply `contentDir.sort` to a list of files. Returns a fresh array so
 * callers don't observe mutation. Defaults to ascending order when only
 * `field` is set (matches the schema's `direction` default).
 */
const sortFiles = (
  files: readonly ContentDirFile[],
  sort: ContentDir['sort']
): readonly ContentDirFile[] => {
  if (sort === undefined) return files.toSorted((a, b) => a.slug.localeCompare(b.slug))
  const direction = sort.direction ?? sort.order ?? 'asc'
  return files.toSorted((a, b) => compareByField(sort.field, direction, a, b))
}

/**
 * Derive an entry's display label. `labelFrom` is preferred (the canonical
 * "use frontmatter title as link text" mode); when the named field is
 * missing or `labelFrom` is unset, fall back to the slug so the sidebar
 * never renders an empty link.
 */
const deriveLabel = (file: ContentDirFile, labelFrom: string | undefined): string => {
  if (typeof labelFrom === 'string') {
    const value = file.frontmatter[labelFrom]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return file.slug
}

/**
 * Build the absolute URL for an entry under a wildcard `:name*` route. Uses
 * the route's static prefix (everything before the wildcard segment) so
 * `/docs/:path*` + slug `guides/setup` resolves to `/docs/guides/setup`.
 *
 * When the page path has no dynamic segment (e.g. a flat `/blog/:slug` shape
 * with a single param), we still concatenate `${prefix}/${slug}` — the
 * wildcard case is the only one Cluster 5 specs exercise, but the helper
 * stays compatible with the non-wildcard shape because the slug never
 * contains a leading `/`.
 */
const buildHref = (pagePath: string, slug: string): string => {
  const prefix = pagePath.replace(/\/:[^/]+\*?$/, '')
  const normalisedPrefix = prefix === '' ? '' : prefix.replace(/\/+$/, '')
  return `${normalisedPrefix}/${slug}`
}

/**
 * Walk filtered + sorted files into `CollectionNavEntry`s. The `currentSlug`
 * marks the entry whose route is being rendered (so the sidebar can hint at
 * the active page via `isCurrent: true`).
 */
/**
 * Resolve a raw group key to its display label: an explicit `groupLabels`
 * override wins; otherwise the key is humanized (kebab/snake/camel → Title
 * Case). Returns undefined for ungrouped entries so the renderer omits the
 * group section heading entirely.
 */
const resolveGroupLabel = (
  group: string | undefined,
  groupLabels: Readonly<Record<string, string>> | undefined
): string | undefined => {
  if (group === undefined) return undefined
  return groupLabels?.[group] ?? humanizeFieldName(group)
}

/**
 * Resolve a raw group key to its configured Lucide icon name: looks up
 * `nav.groupIcons[group]` and returns the kebab-case name when present.
 * Returns undefined for ungrouped entries or when no icon is configured, so
 * the renderer omits the leading section glyph (graceful, label-only fallback).
 */
const resolveGroupIcon = (
  group: string | undefined,
  groupIcons: Readonly<Record<string, string>> | undefined
): string | undefined => {
  if (group === undefined) return undefined
  return groupIcons?.[group]
}

const buildSidebarEntries = (
  files: readonly ContentDirFile[],
  contentDir: ContentDir,
  pagePath: string,
  currentSlug: string | undefined
): readonly CollectionNavEntry[] => {
  const labelFrom = contentDir.nav?.labelFrom
  const groupBy = contentDir.nav?.groupBy
  const groupLabels = contentDir.nav?.groupLabels
  const groupIcons = contentDir.nav?.groupIcons
  // [internal ref]: the index article's sidebar entry links to the collection BASE
  // PATH (its single canonical URL), not its slugged URL — so prev/next
  // neighbours point to/from the base path too.
  const indexBasePath =
    contentDir.index !== undefined ? deriveContentDirIndexBasePath(pagePath) : undefined
  return files.map((file) => {
    const orderRaw = file.frontmatter['order']
    const orderNum = orderRaw === undefined ? undefined : Number(orderRaw)
    const group = typeof groupBy === 'string' ? file.frontmatter[groupBy] : undefined
    const isIndex = indexBasePath !== undefined && file.slug === contentDir.index
    return {
      slug: file.slug,
      href: isIndex && indexBasePath !== undefined ? indexBasePath : buildHref(pagePath, file.slug),
      label: deriveLabel(file, labelFrom),
      group,
      groupLabel: resolveGroupLabel(group, groupLabels),
      groupIcon: resolveGroupIcon(group, groupIcons),
      order: Number.isFinite(orderNum) ? orderNum : undefined,
      isCurrent: currentSlug !== undefined && file.slug === currentSlug,
    }
  })
}

/**
 * Read every markdown file under `contentDir.directory` (via the shared,
 * stat-revalidated corpus cache in the infrastructure enumerator), then apply
 * `filter` + `sort`. Pure-data result — the caller turns this into the
 * `sidebar`/`previous`/`next` shape.
 *
 * Note: deliberately scans every `.md` file (no `include` narrowing) — the
 * sidebar has always listed the full directory; keep that behavior.
 */
const loadFilteredFiles = async (contentDir: ContentDir): Promise<readonly ContentDirFile[]> => {
  const corpus = await loadContentDirCorpus(normaliseDirectory(contentDir.directory))
  const presentFiles = corpus.map((file) => ({
    slug: filePathToSlug(file.relativePath),
    frontmatter: file.frontmatter,
  }))
  const filteredFiles = presentFiles.filter((file) =>
    matchesContentDirFilter(contentDir.filter, file.frontmatter)
  )
  return sortFiles(filteredFiles, contentDir.sort)
}

/**
 * Resolve the adjacent (previous / next) entries relative to `currentSlug`
 * in the sorted list. Returns `undefined` for boundary positions (the first
 * entry has no previous; the last has no next).
 */
const buildPrevNext = (
  entries: readonly CollectionNavEntry[],
  currentSlug: string | undefined
): { previous: CollectionPrevNext | undefined; next: CollectionPrevNext | undefined } => {
  if (currentSlug === undefined) return { previous: undefined, next: undefined }
  const idx = entries.findIndex((entry) => entry.slug === currentSlug)
  if (idx < 0) return { previous: undefined, next: undefined }
  const prevEntry = idx > 0 ? entries[idx - 1] : undefined
  const nextEntry = idx < entries.length - 1 ? entries[idx + 1] : undefined
  return {
    previous: prevEntry ? { href: prevEntry.href, label: prevEntry.label } : undefined,
    next: nextEntry ? { href: nextEntry.href, label: nextEntry.label } : undefined,
  }
}

/**
 * List the collection sidebar + prev/next neighbours for a `contentDir`
 * page. Returns an empty payload (`sidebar: []`, both adjacents undefined)
 * when the directory does not exist or contains no readable files so the
 * route still renders without throwing.
 *
 * The `pagePath` is needed to reconstruct each entry's URL from the route's
 * wildcard prefix (e.g. `/docs/:path*` + slug `guides/setup` → `/docs/guides/setup`).
 */
export const listContentDir = async (
  contentDir: ContentDir,
  pagePath: string,
  currentSlug: string | undefined
): Promise<CollectionNavData> => {
  const files = await loadFilteredFiles(contentDir)
  const sidebar = buildSidebarEntries(files, contentDir, pagePath, currentSlug)
  const { previous, next } = buildPrevNext(sidebar, currentSlug)
  return {
    sidebar,
    previous,
    next,
    collapsed: contentDir.nav?.collapsed === true,
    tabs: contentDir.nav?.tabs,
  }
}
