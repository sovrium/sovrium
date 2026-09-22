/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content-directory enumerator — the single source of truth for "given a
 * `contentDir` page config, list the markdown files it generates one route
 * per".
 *
 * Walks the markdown files under `contentDir.directory` via `Bun.Glob`, honours
 * the optional `include` glob, parses each file's YAML frontmatter via the
 * domain `splitFrontmatter` helper, applies the shared `contentDir.filter`
 * predicate, sorts by `contentDir.sort`, and derives a URL slug per the
 * `slugFrom` mode (`filename` → basename, `filepath` → nested path).
 *
 * Lives in the infrastructure layer because file I/O is a side effect. Both the
 * sitemap generator and the command-palette search use case (application layer)
 * consume this enumerator — application use cases may import infrastructure
 * (Phase-1 pragmatic boundary). The presentation-layer `content-dir-lister`
 * builds its richer sidebar/prev-next payload separately, but reuses the same
 * domain `splitFrontmatter` + `matchesContentDirFilter` primitives so the
 * file-discovery semantics stay consistent.
 *
 * Reads `SOVRIUM_CONTENT_DIR` directly (same env anchor the presentation
 * `content-base-dir` resolver uses) so relative `contentDir.directory` paths
 * resolve identically in the deployed binary and the E2E harness.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { splitFrontmatter } from '@/domain/kernel/markdown/markdown-renderer'
import { matchesContentDirFilter } from '@/domain/models/app/pages/content-dir-filter'
import { deriveContentDirIndexBasePath } from '@/domain/models/app/pages/content-dir-index-base-path'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'

/**
 * A single markdown file resolved from a `contentDir` page.
 */
export interface ContentDirEntry {
  /** URL slug derived from the file per `slugFrom` (e.g. `getting-started`). */
  readonly slug: string
  /** Frontmatter `title`, or the slug when no title is declared. */
  readonly title: string
  /** Frontmatter `section`/`category` group, when present. */
  readonly section: string | undefined
  /**
   * Group key resolved from `contentDir.nav.groupBy` (falling back to
   * `section`/`category`), when present. Drives the H2 sections in `/llms.txt`.
   */
  readonly group: string | undefined
  /** Frontmatter `description`, when present. */
  readonly description: string | undefined
  /** Resolved page URL (route prefix + slug, e.g. `/docs/getting-started`). */
  readonly path: string
}

/**
 * Parsed file record before slug derivation — one file of a cached corpus.
 * Exported for the presentation `content-dir-lister`, which derives its own
 * slug/sidebar shape from the shared corpus.
 */
export interface ParsedFile {
  readonly relativePath: string
  readonly frontmatter: Readonly<Record<string, string>>
  readonly body: string
}

/**
 * A markdown file's resolved metadata paired with its full markdown body
 * (frontmatter stripped). Consumed by the `/llms-full.txt` generator.
 */
export interface ContentDirBody {
  /** The entry metadata (slug, title, group, path, …). */
  readonly entry: ContentDirEntry
  /** The markdown body with the YAML frontmatter block removed. */
  readonly body: string
}

/** Strip trailing `/` from `contentDir.directory` (defensive). */
const normaliseDirectory = (directory: string): string => directory.replace(/\/+$/, '')

const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

/**
 * Resolve the base directory relative `contentDir.directory` paths anchor to.
 * Mirrors the presentation `getContentBaseDir` env contract.
 */
const getContentBaseDir = (): string => {
  const override = process.env['SOVRIUM_CONTENT_DIR']
  return typeof override === 'string' && override.length > 0 ? override : process.cwd()
}

/**
 * Derive the URL slug for a file. `filename` mode (default) uses the basename
 * without `.md` (so `guides/setup.md` → `setup`); `filepath` mode keeps the
 * nested path (so `guides/setup.md` → `guides/setup`).
 */
const deriveSlug = (relativePath: string, slugFrom: ContentDir['slugFrom']): string => {
  const withoutExt = stripLeadingSlash(relativePath).replace(/\.md$/i, '')
  if (slugFrom === 'filepath') return withoutExt
  const segments = withoutExt.split('/')
  return segments[segments.length - 1] ?? withoutExt
}

/**
 * Build the page URL for an entry from the route's static prefix (everything
 * before the first dynamic `:param`/`*` segment) plus the slug.
 * `/docs/:slug` + `getting-started` → `/docs/getting-started`.
 */
const buildPath = (pagePath: string, slug: string): string => {
  const prefix = pagePath.replace(/\/:[^/]+\*?$/, '').replace(/\/\*$/, '')
  const normalisedPrefix = prefix === '' ? '' : prefix.replace(/\/+$/, '')
  return `${normalisedPrefix}/${slug}`
}

/** Glob-scan a directory for `.md` files (relative paths). */
const scanMarkdownFiles = async (
  directory: string,
  include: string | undefined
): Promise<readonly string[]> => {
  try {
    const absoluteDir = isAbsolute(directory) ? directory : resolve(getContentBaseDir(), directory)
    const pattern = include ?? '**/*.md'
    const glob = new Bun.Glob(pattern)
    return await Array.fromAsync(glob.scan({ cwd: absoluteDir }))
  } catch {
    return []
  }
}

/** Read + parse a single markdown file's frontmatter. */
const readFile = async (
  directory: string,
  relativePath: string
): Promise<ParsedFile | undefined> => {
  try {
    const absolutePath = isAbsolute(directory)
      ? `${directory}/${relativePath}`
      : resolve(getContentBaseDir(), directory, relativePath)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    const { frontmatter, body } = splitFrontmatter(await file.text())
    return { relativePath, frontmatter, body }
  } catch {
    return undefined
  }
}

/**
 * Sort comparator backing `contentDir.sort`. Numeric fields sort numerically;
 * otherwise a lexical compare keeps ordering deterministic. Falls back to slug
 * order when no sort is configured.
 */
const sortFiles = (
  files: readonly ParsedFile[],
  sort: ContentDir['sort'],
  slugFrom: ContentDir['slugFrom']
): readonly ParsedFile[] => {
  if (sort === undefined) {
    return files.toSorted((a, b) =>
      deriveSlug(a.relativePath, slugFrom).localeCompare(deriveSlug(b.relativePath, slugFrom))
    )
  }
  const direction = sort.direction ?? sort.order ?? 'asc'
  return files.toSorted((a, b) => {
    const av = a.frontmatter[sort.field] ?? ''
    const bv = b.frontmatter[sort.field] ?? ''
    const an = Number(av)
    const bn = Number(bv)
    const numeric = Number.isFinite(an) && Number.isFinite(bn) && av !== '' && bv !== ''
    const diff = numeric ? an - bn : av.localeCompare(bv)
    return direction === 'asc' ? diff : -diff
  })
}

/**
 * Resolve an entry's public URL. [internal ref]: the `contentDir.index` article is
 * listed at the collection BASE PATH (its single canonical URL — the page path
 * minus its trailing dynamic segment), so sitemap `<loc>` / `/llms.txt` bullets
 * / search results deep-link `/docs` rather than `/docs/introduction`. Every
 * other file keeps its slugged path.
 */
const resolveEntryPath = (contentDir: ContentDir, pagePath: string, slug: string): string => {
  if (contentDir.index !== undefined && slug === contentDir.index) {
    return deriveContentDirIndexBasePath(pagePath) ?? buildPath(pagePath, slug)
  }
  return buildPath(pagePath, slug)
}

/** Build a {@link ContentDirEntry} from a parsed file. */
const toEntry = (
  file: ParsedFile,
  contentDir: ContentDir,
  pagePath: string,
  groupByField: string | undefined
): ContentDirEntry => {
  const slug = deriveSlug(file.relativePath, contentDir.slugFrom)
  const { title } = file.frontmatter
  const section = file.frontmatter['section'] ?? file.frontmatter['category']
  const group = groupByField ? (file.frontmatter[groupByField] ?? section) : section
  return {
    slug,
    title: typeof title === 'string' && title.length > 0 ? title : slug,
    section,
    group,
    description: file.frontmatter['description'],
    path: resolveEntryPath(contentDir, pagePath, slug),
  }
}

/** A cached scan+parse result for one `(directory, include)` pair. */
interface CachedCorpus {
  readonly files: readonly ParsedFile[]
  readonly signature: string
}

/**
 * Process-global corpus cache, keyed by `${absoluteDir}::${include}`.
 *
 * The scan + read + frontmatter-parse of a whole content directory (hundreds
 * of files for a real docs site) used to run on EVERY page render, sitemap
 * build, and palette search. The corpus is cached here and revalidated by a
 * cheap stat signature — except in production, where content is immutable for
 * the process lifetime (deploys replace the whole tree), so the first fill is
 * trusted without further stats.
 *
 * Dev safety: `--watch` only watches the config file, so markdown edits never
 * restart the server — the stat-signature revalidation (re-glob + `stat` per
 * file, ~1-2ms for ~200 files vs ~50ms+ for read+parse-all) is what keeps the
 * dev edit-refresh loop working. Memory note: bodies stay resident (~a few MB
 * for a large docs corpus) — the deliberate trade for not re-reading disk.
 */
const corpusCache = new Map<string, CachedCorpus>()

const isProductionEnv = (): boolean => process.env['NODE_ENV'] === 'production'

/** Resolve the absolute directory a `contentDir.directory` points at. */
const resolveAbsoluteDir = (directory: string): string =>
  isAbsolute(directory) ? directory : resolve(getContentBaseDir(), directory)

/** `path:mtimeMs:size` for every scanned file, joined — order-stable. */
const computeStatSignature = async (
  absoluteDir: string,
  relativePaths: readonly string[]
): Promise<string> => {
  const stats = await Promise.all(
    [...relativePaths].toSorted().map(async (relativePath) => {
      try {
        const s = await stat(`${absoluteDir}/${relativePath}`)
        return `${relativePath}:${s.mtimeMs}:${s.size}`
      } catch {
        return `${relativePath}:missing`
      }
    })
  )
  return stats.join('|')
}

/**
 * Compute a short checksum of a content directory's CURRENT on-disk state — the
 * page cache's corpus key for a `'content'` page ([internal ref]
 * -CACHE, [internal ref]..008).
 *
 * Deliberately does its own glob + `stat` scan on EVERY call rather than
 * reusing {@link loadContentDirCorpus}'s memoized signature: that cache
 * short-circuits under `NODE_ENV=production` (first fill is trusted), which
 * would make page-cache invalidation dead in exactly the deployed binaries
 * where it matters. A stats-only scan costs ~1-2 ms for a few hundred files —
 * against 50 ms+ to re-read, re-parse and re-render the collection — so paying
 * it per request is the right trade.
 *
 * Both `mtimeMs` and `size` participate (via {@link computeStatSignature}), so
 * a same-millisecond rewrite that changes a file's length still changes the
 * checksum. A missing/unreadable directory yields the checksum of an empty
 * scan, which is stable and therefore still safe to key on.
 *
 * @param directory - The `contentDir.directory` value (trailing `/` tolerated).
 * @param include - Optional include glob; defaults to every `.md` file, recursively.
 */
export const computeContentDirCorpusChecksum = async (
  directory: string,
  include?: string
): Promise<string> => {
  const normalised = normaliseDirectory(directory)
  const relativePaths = await scanMarkdownFiles(normalised, include)
  const signature = await computeStatSignature(resolveAbsoluteDir(normalised), relativePaths)
  return Bun.hash(signature).toString(36)
}

/** Clear the corpus cache (tests + hot-reload paths). */
export const clearContentDirCache = (): void => {
  // eslint-disable-next-line functional/immutable-data -- cache reset is this helper's entire purpose
  corpusCache.clear()
}

/**
 * Load the parsed (pre-filter, pre-sort) corpus of a content directory, from
 * the cache when the stat signature still matches. Exported so the
 * presentation `content-dir-lister` shares the same cached scan instead of
 * re-reading the whole directory per sidebar render.
 *
 * @param directory - The `contentDir.directory` value (trailing `/` tolerated).
 * @param include - Optional include glob; defaults to every `.md` file, recursively.
 */
export const loadContentDirCorpus = async (
  directory: string,
  include?: string
): Promise<readonly ParsedFile[]> => {
  const normalised = normaliseDirectory(directory)
  const cacheKey = `${resolveAbsoluteDir(normalised)}::${include ?? '**/*.md'}`
  const cached = corpusCache.get(cacheKey)
  if (cached !== undefined && isProductionEnv()) return cached.files

  const relativePaths = await scanMarkdownFiles(normalised, include)
  const signature = await computeStatSignature(resolveAbsoluteDir(normalised), relativePaths)
  if (cached !== undefined && cached.signature === signature) return cached.files

  const parsed = await Promise.all(relativePaths.map((path) => readFile(normalised, path)))
  const files = parsed.filter((file): file is ParsedFile => file !== undefined)
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- memoization write; the surrounding function stays referentially transparent per signature
  corpusCache.set(cacheKey, { files, signature })
  return files
}

/** Scan + parse + filter + sort the markdown files for a `contentDir`. */
const collectSortedFiles = async (contentDir: ContentDir): Promise<readonly ParsedFile[]> => {
  const present = await loadContentDirCorpus(contentDir.directory, contentDir.include)
  const filtered = present.filter((file) =>
    matchesContentDirFilter(contentDir.filter, file.frontmatter)
  )
  return sortFiles(filtered, contentDir.sort, contentDir.slugFrom)
}

/**
 * Enumerate every markdown file a `contentDir` page generates a route for.
 *
 * @param contentDir - The page's `contentDir` config.
 * @param pagePath - The page's declared route (e.g. `/docs/:slug`). The static
 *   prefix is used to build each entry's resolved URL.
 * @returns One {@link ContentDirEntry} per included markdown file, in
 *   `contentDir.sort` order. Empty when the directory is missing or empty.
 */
export const enumerateContentDir = async (
  contentDir: ContentDir,
  pagePath: string
): Promise<readonly ContentDirEntry[]> => {
  const sorted = await collectSortedFiles(contentDir)
  const groupByField = contentDir.nav?.groupBy
  return sorted.map((file) => toEntry(file, contentDir, pagePath, groupByField))
}

/**
 * Enumerate every markdown file a `contentDir` page generates a route for,
 * paired with its full markdown body (frontmatter stripped). Used by the
 * `/llms-full.txt` generator to concatenate raw page content.
 *
 * @param contentDir - The page's `contentDir` config.
 * @param pagePath - The page's declared route (e.g. `/docs/:slug`).
 * @returns One {@link ContentDirBody} per included markdown file, in
 *   `contentDir.sort` order. Empty when the directory is missing or empty.
 */
export const readContentDirBodies = async (
  contentDir: ContentDir,
  pagePath: string
): Promise<readonly ContentDirBody[]> => {
  const sorted = await collectSortedFiles(contentDir)
  const groupByField = contentDir.nav?.groupBy
  return sorted.map((file) => ({
    entry: toEntry(file, contentDir, pagePath, groupByField),
    body: file.body,
  }))
}

/**
 * Read a single contentDir article's frontmatter-stripped markdown body by slug
 * — the per-page `.md` export twin. Returns
 * `undefined` when no included file resolves to that slug: an unknown slug, or a
 * file hidden by `contentDir.filter` (e.g. a draft). Both are a genuine
 * not-found for the `.md` route, so restricted content is never leaked.
 *
 * Reuses the same scan → filter → parse pipeline as {@link readContentDirBodies}
 * (which backs `/llms-full.txt`), so the served body is frontmatter-stripped and
 * the draft/publish filter stays consistent with the HTML article route.
 */
export const readContentDirBodyForSlug = async (
  contentDir: ContentDir,
  slug: string
): Promise<string | undefined> => {
  const sorted = await collectSortedFiles(contentDir)
  const match = sorted.find((file) => deriveSlug(file.relativePath, contentDir.slugFrom) === slug)
  return match?.body
}
