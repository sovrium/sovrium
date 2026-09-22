/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { Data, Effect } from 'effect'
import { logDebug } from '@/infrastructure/logging'
import { resolvePackagePath } from '@/infrastructure/process/package-paths'

/**
 * `generateSearchIndex` — pure Application use-case that materializes the
 * client-side search artifacts for the public-pages search feature.
 *
 * Produces, under `<outputDir>/sovrium-search/`:
 *
 *   - `index.json` — a TF-IDF token index over the textual body of each
 *     public page, plus a flat list of page records (`url`, `title`,
 *     `excerptText`).
 *   - `runtime.js` — a tiny IIFE that exposes
 *     `window.SovriumSearch = { init, search }` so the page-search island
 *     can query the index in the browser.
 *
 * ## Activation
 *
 * Called by `src/index.ts::build` only when `hasPageSearchComponent(app)` is
 * true. Absent the gate, no `sovrium-search/` directory is emitted.
 *
 * ## Inputs
 *
 * Operates on the already-written static HTML directory. Reads each public
 * page's HTML and extracts:
 *   - title via `<title>` or first `<h1>` (in that order)
 *   - body text by stripping all tags
 *   - excerpt as the first ~200 chars of normalized body text
 *
 * Then tokenizes (lowercase + NFC normalize + split on `\W+` + drop short
 * tokens and a small stopword set) and builds a TF-IDF index with a 2× title
 * boost for tokens that also occur in the page title.
 *
 * @see src/domain/models/app/pages/has-page-search.ts (activation gate)
 * @see src/application/use-cases/server/static-language-generators.ts
 *      (already filters to public pages — input here is leak-safe)
 */
export interface GenerateSearchIndexInput {
  /** Directory containing the already-emitted public-page HTML files. */
  readonly inputDir: string
  /** Directory under which `sovrium-search/` is written (usually `inputDir`). */
  readonly outputDir: string
  /** Page URLs to index (e.g. `['/', '/about']`). */
  readonly publicPagePaths: readonly string[]
}

export interface GenerateSearchIndexResult {
  /** Relative paths under `outputDir` of the files written. */
  readonly files: readonly string[]
}

export class GenerateSearchIndexError extends Data.TaggedError('GenerateSearchIndexError')<{
  readonly cause: unknown
  readonly message: string
}> {}

// ── Internal types ───────────────────────────────────────────────────────────

interface PageRecord {
  readonly url: string
  readonly title: string
  readonly excerptText: string
}

interface PageTokens {
  readonly url: string
  readonly title: string
  readonly excerptText: string
  readonly tokens: readonly string[]
  readonly titleTokens: ReadonlySet<string>
}

interface TokenPosting {
  readonly url: string
  readonly score: number
}

// ── Tokenization ─────────────────────────────────────────────────────────────

const STOPWORDS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'can',
  'could',
  'should',
  'may',
  'might',
])

const MIN_TOKEN_LENGTH = 2
const TITLE_BOOST = 2
const EXCERPT_LENGTH = 200

const tokenize = (text: string): readonly string[] =>
  text
    .normalize('NFC')
    .toLowerCase()
    .split(/\W+/u)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token))

// ── HTML parsing ─────────────────────────────────────────────────────────────

/**
 * Extract a page title from raw HTML. Prefers `<title>`; falls back to the
 * first `<h1>`. Returns an empty string when neither is present.
 */
const extractTitle = (html: string): string => {
  const titleMatch = /<title[^>]*>([^<]*)<\/title(?:\s[^>]*)?>/iu.exec(html)
  if (titleMatch && titleMatch[1]) {
    return decodeHtmlEntities(titleMatch[1]).trim()
  }
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1(?:\s[^>]*)?>/iu.exec(html)
  if (h1Match && h1Match[1]) {
    return decodeHtmlEntities(stripTags(h1Match[1])).trim()
  }
  return ''
}

/**
 * Locate the element marked with `data-sovrium-search-body` and return its
 * inner HTML. The marker (placed on `<main>` by `page-main.tsx`) confines the
 * indexer to the page's primary content region, excluding header/nav/footer
 * chrome that would otherwise pollute every page's excerpt with shared text.
 *
 * Returns `undefined` when the marker is absent (older schemas, pages that
 * bypass `PageMain`), in which case `extractBodyText` falls back to the
 * legacy whole-document extraction.
 */
const extractSearchBodySubtree = (html: string): string | undefined => {
  // Find the opening tag that carries the marker attribute. The marker may
  // appear with or without a value (`data-sovrium-search-body` or
  // `data-sovrium-search-body=""`), and the tag name varies (`<main>` today,
  // potentially other landmarks tomorrow).
  const openMatch = /<([a-z][a-z0-9-]*)\b[^>]*\bdata-sovrium-search-body\b[^>]*>/iu.exec(html)
  if (!openMatch) return undefined
  const tagName = openMatch[1]?.toLowerCase()
  if (!tagName) return undefined

  const start = openMatch.index + openMatch[0].length
  // Build a tag-specific closer regex. We use a non-greedy scan to the FIRST
  // matching close tag — this is safe because the marker is intended for
  // non-nestable landmark elements like `<main>`. If a future caller places
  // the marker on a nestable element (e.g. `<div>`), this would under-capture;
  // that's the explicit trade-off for staying parser-free per the indexer's
  // contract.
  const closer = new RegExp(`</${tagName}(?:\\s[^>]*)?>`, 'iu')
  const closeMatch = closer.exec(html.slice(start))
  if (!closeMatch) return undefined

  return html.slice(start, start + closeMatch.index)
}

/**
 * Extract textual body content from raw HTML by stripping all tags and the
 * `<script>`/`<style>` blocks entirely. Whitespace is collapsed, then entity
 * references are decoded so the tokenizer sees the actual words (e.g.
 * `caf&eacute;` → `café`).
 *
 * When the source HTML carries a `data-sovrium-search-body` marker (placed on
 * `<main>` by `page-main.tsx`), only the marker's subtree is indexed — chrome
 * (header/nav/footer) is excluded so per-page excerpts surface page-specific
 * content rather than shared layout text. Pages without the marker fall back
 * to whole-document extraction.
 *
 * ## Security note (consumed by spec 001 page-search island)
 *
 * The returned text is **plain text after entity decoding** — it may legally
 * contain `<` and `>` characters if the source HTML used `&lt;` / `&gt;`
 * entities. Consumers MUST render `excerptText` via `.textContent` (or
 * React's default child interpolation), NEVER via `.innerHTML` /
 * `dangerouslySetInnerHTML`. The CLAUDE.md S2 rule forbids adding a second
 * sanitizer here; the contract is "this is plain text — render it as text".
 */
const extractBodyText = (html: string): string => {
  // Prefer the marker subtree when present; fall back to whole-document.
  const source = extractSearchBodySubtree(html) ?? html

  // Drop <script>, <style>, <head> chunks before tag-stripping so their
  // contents don't poison the index. <head> is irrelevant for the marker
  // subtree but kept here for the fallback path.
  const withoutScripts = source.replace(/<script[\s\S]*?<\/script(?:\s[^>]*)?>/giu, ' ')
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style(?:\s[^>]*)?>/giu, ' ')
  const withoutHead = withoutStyles.replace(/<head[\s\S]*?<\/head(?:\s[^>]*)?>/giu, ' ')
  const text = stripTags(withoutHead)
  return decodeHtmlEntities(text).replace(/\s+/gu, ' ').trim()
}

const stripTags = (html: string): string => html.replace(/<[^>]+>/gu, ' ')

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

const decodeHtmlEntities = (text: string): string =>
  text.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/gu, (match) => HTML_ENTITIES[match] ?? match)

// ── HTML file resolution ─────────────────────────────────────────────────────

/**
 * Resolve a page URL to the on-disk HTML file path. Hono's toSSG writes
 * either `<inputDir>/<path>/index.html` (nested) or `<inputDir>/<path>.html`
 * (flat). The root path `/` becomes `<inputDir>/index.html`.
 *
 * Returns `null` when no readable file matches either shape — the page is
 * silently skipped so the indexer is robust against pages that were excluded
 * from the static emission for any reason.
 */
const fileExists = (filePath: string): Effect.Effect<boolean> =>
  Effect.tryPromise({
    // `fs.access` rejects when the file is missing. We deliberately swallow
    // that rejection (the absent file IS the "skip this page" signal) by
    // mapping the failure channel to `false`.
    try: () => fs.access(filePath).then(() => true),
    catch: () => false as const,
  }).pipe(
    // effect-swallow: the `catch` above already turned the rejection into `false`, which IS the "skip this page" signal; this only moves that value out of the error channel, so there is no failure left to observe.
    Effect.orElseSucceed(() => false)
  )

const resolveHtmlPath = (inputDir: string, pagePath: string): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    // Strip leading slash; toSSG paths are relative to inputDir.
    const normalized = pagePath === '/' ? '' : pagePath.replace(/^\/+/u, '')

    const candidates =
      normalized === ''
        ? [path.join(inputDir, 'index.html')]
        : [path.join(inputDir, normalized, 'index.html'), path.join(inputDir, `${normalized}.html`)]

    // Test candidates in order; first hit wins. Sequential is fine — at most
    // 2 candidates per page and the indexer is offline build-time anyway.
    const checks = yield* Effect.forEach(candidates, fileExists, { concurrency: 1 })
    const hitIndex = checks.findIndex((exists) => exists)
    return hitIndex === -1 ? undefined : candidates[hitIndex]
  })

// ── Per-page indexing ────────────────────────────────────────────────────────

const indexPage = (
  inputDir: string,
  pagePath: string
): Effect.Effect<PageTokens | undefined, GenerateSearchIndexError> =>
  Effect.gen(function* () {
    const filePath = yield* resolveHtmlPath(inputDir, pagePath)
    if (filePath === undefined) {
      logDebug(`[search-index] no HTML file found for page path "${pagePath}", skipping`)
      return undefined
    }

    const html = yield* Effect.tryPromise({
      try: () => fs.readFile(filePath, 'utf-8'),
      catch: (cause) =>
        new GenerateSearchIndexError({
          cause,
          message: `Failed to read HTML for page "${pagePath}" at ${filePath}`,
        }),
    })

    const title = extractTitle(html)
    const bodyText = extractBodyText(html)
    const excerptText =
      bodyText.length <= EXCERPT_LENGTH ? bodyText : `${bodyText.slice(0, EXCERPT_LENGTH)}...`
    const tokens = tokenize(bodyText)
    const titleTokens = new Set(tokenize(title))

    return {
      url: pagePath,
      title,
      excerptText,
      tokens,
      titleTokens,
    } satisfies PageTokens
  })

// ── Index construction ───────────────────────────────────────────────────────

interface SearchIndex {
  readonly pages: readonly PageRecord[]
  readonly tokens: Readonly<Record<string, readonly TokenPosting[]>>
}

type CountMap = Readonly<Record<string, number>>

/**
 * Insertion sort that returns a NEW array sorted desc by `score` without
 * mutating the input. Used instead of `[...arr].sort()` because Sovrium's
 * `no-restricted-syntax` rule forbids every `.sort()` call — even on a
 * freshly-spread copy. O(n²) is fine here: per-token postings lists are tiny
 * (one entry per page that contains the token).
 */
const insertionSortByScoreDesc = (postings: readonly TokenPosting[]): readonly TokenPosting[] =>
  postings.reduce<readonly TokenPosting[]>((sorted, posting) => {
    const insertAt = sorted.findIndex((existing) => existing.score < posting.score)
    return insertAt === -1
      ? [...sorted, posting]
      : [...sorted.slice(0, insertAt), posting, ...sorted.slice(insertAt)]
  }, [])

/** Token → count, computed as a reduce over a token array (no mutation). */
const countTokens = (tokens: readonly string[]): CountMap =>
  tokens.reduce<CountMap>((acc, token) => ({ ...acc, [token]: (acc[token] ?? 0) + 1 }), {})

/** Token → number of pages it appears in (document frequency). */
const documentFrequency = (pages: readonly PageTokens[]): CountMap =>
  pages.reduce<CountMap>(
    (acc, page) =>
      [...new Set(page.tokens)].reduce<CountMap>(
        (inner, token) => ({ ...inner, [token]: (inner[token] ?? 0) + 1 }),
        acc
      ),
    {}
  )

/**
 * Per-page TF-IDF postings: returns `[token, posting][]` for every distinct
 * token in this page. Title-token matches receive a TITLE_BOOST multiplier.
 * Empty-token pages produce an empty array (no-op in the reduce below).
 */
const pagePostings = (
  page: PageTokens,
  df: CountMap,
  totalPages: number
): readonly (readonly [string, TokenPosting])[] => {
  const totalTokens = page.tokens.length
  if (totalTokens === 0) return []
  const tf = countTokens(page.tokens)
  return Object.entries(tf).map(([token, count]) => {
    const docFreq = df[token] ?? 1
    const idf = Math.log(Math.max(1, totalPages) / docFreq)
    const baseScore = (count / totalTokens) * idf
    const score = page.titleTokens.has(token) ? baseScore * TITLE_BOOST : baseScore
    return [token, { url: page.url, score }] as const
  })
}

const buildIndex = (pages: readonly PageTokens[]): SearchIndex => {
  const totalPages = pages.length
  const df = documentFrequency(pages)

  // Flatten every page's postings into a single [token, posting][] stream,
  // then group by token. Each group is a fresh array, so the upstream pages
  // are never mutated.
  const allPostings = pages.flatMap((page) => pagePostings(page, df, totalPages))
  const groupedTokens = allPostings.reduce<Readonly<Record<string, readonly TokenPosting[]>>>(
    (acc, [token, posting]) => ({
      ...acc,
      [token]: [...(acc[token] ?? []), posting],
    }),
    {}
  )

  // Sort each postings list desc by score. We use insertion-sort via reduce
  // (rather than `[...arr].sort(...)`) because Sovrium's `no-restricted-syntax`
  // forbids `.sort()` outright — even on a freshly-spread copy.
  const sortedTokens: Readonly<Record<string, readonly TokenPosting[]>> = Object.fromEntries(
    Object.entries(groupedTokens).map(([token, postings]) => [
      token,
      insertionSortByScoreDesc(postings),
    ])
  )

  const pageRecords: readonly PageRecord[] = pages.map((page) => ({
    url: page.url,
    title: page.title,
    excerptText: page.excerptText,
  }))

  return { pages: pageRecords, tokens: sortedTokens }
}

// ── Runtime IIFE (compiled from shared matcher) ──────────────────────────────

/**
 * Build the client-side runtime IIFE for `<outputDir>/sovrium-search/runtime.js`.
 *
 * Compiles {@link ../../presentation/islands/page-search/runtime-entry.ts}
 * (which imports the shared `matcher` module) to a single self-executing
 * browser-targeted script. This makes the vanilla-JS runtime and the React
 * `page-search-island` share ONE source of truth for tokenization + ranked
 * lookup — they can never diverge.
 *
 * ## TODO: standalone-binary embedding (compiled mode)
 *
 * In dev/`bun start`, `resolvePackagePath('src', 'presentation', 'islands',
 * 'page-search', 'runtime-entry.ts')` resolves to an on-disk file that
 * `Bun.build` can consume directly.
 *
 * In **compiled-binary mode** (`bun build --compile`), `SOVRIUM_PACKAGE_ROOT`
 * points at the binary's directory which does NOT ship `src/` — so this call
 * will fail. The follow-up is to either:
 *
 *   1. Pre-compile the IIFE at build time and embed the resulting JS string
 *      via `import runtimeJs from './runtime.iife.js' with { type: 'file' }`,
 *      then read it from disk and skip the `Bun.build` step in compiled mode.
 *   2. Add `runtime-entry.ts` + `matcher.ts` to a binary-embed asset list
 *      (parallel to `scripts/build/generate-embedded-runtime-assets.ts`) so
 *      `Bun.build` can find them in the `$bunfs/...` virtual filesystem.
 *
 * Option (1) is preferred — it sidesteps `Bun.build` at runtime entirely and
 * keeps the cold-boot path tight. Tracked as a binary-packaging follow-up;
 * the page-search feature itself ships safely in dev / `bun start` today.
 */
const buildRuntimeJs = (): Effect.Effect<string, GenerateSearchIndexError> =>
  Effect.tryPromise({
    try: async () => {
      const entrypoint = resolvePackagePath(
        'src',
        'presentation',
        'islands',
        'page-search',
        'runtime-entry.ts'
      )
      const result = await Bun.build({
        entrypoints: [entrypoint],
        target: 'browser',
        format: 'iife',
        minify: false,
      })
      if (!result.success) {
        const errors = result.logs.map((l) => l.message).join('\n')
        // eslint-disable-next-line functional/no-throw-statements
        throw new Error(`runtime.js build failed:\n${errors}`)
      }
      const output = result.outputs[0]
      if (!output) {
        // eslint-disable-next-line functional/no-throw-statements
        throw new Error('runtime.js build produced no output')
      }
      return output.text()
    },
    catch: (cause) =>
      new GenerateSearchIndexError({
        cause,
        message: 'Failed to build sovrium-search runtime.js from shared matcher',
      }),
  })

// ── Public use-case ──────────────────────────────────────────────────────────

const ensureDir = (dir: string) =>
  Effect.tryPromise({
    try: () => fs.mkdir(dir, { recursive: true }),
    catch: (cause) =>
      new GenerateSearchIndexError({
        cause,
        message: `Failed to create directory ${dir}`,
      }),
  })

// Generic JSON serialization sink: writes an already statically-typed value
// (here a `SearchIndex` built by `buildIndex`) to disk. effect(preferSchemaOverJson)
// suggests Effect Schema's JSON APIs, but the payload has no Effect Schema —
// only a TS interface — and is trusted output we produce, not untrusted input we
// parse. Introducing a parallel `Schema.Struct` mirror purely to satisfy the
// informational hint would duplicate the type with no validation benefit.
const writeJsonFile = (filePath: string, data: unknown) =>
  Effect.tryPromise({
    try: () => fs.writeFile(filePath, JSON.stringify(data), 'utf-8'),
    catch: (cause) =>
      new GenerateSearchIndexError({
        cause,
        message: `Failed to write JSON to ${filePath}`,
      }),
  })

const writeTextFile = (filePath: string, contents: string) =>
  Effect.tryPromise({
    try: () => fs.writeFile(filePath, contents, 'utf-8'),
    catch: (cause) =>
      new GenerateSearchIndexError({
        cause,
        message: `Failed to write text to ${filePath}`,
      }),
  })

export const generateSearchIndex = (
  input: GenerateSearchIndexInput
): Effect.Effect<GenerateSearchIndexResult, GenerateSearchIndexError> =>
  Effect.gen(function* () {
    logDebug(
      `[search-index] indexing ${input.publicPagePaths.length} public pages from ${input.inputDir}`
    )

    // Per-page indexing (sequential — page count is small, fs reads cheap,
    // and we want deterministic ordering in the emitted index).
    const indexed = yield* Effect.forEach(
      input.publicPagePaths,
      (pagePath) => indexPage(input.inputDir, pagePath),
      { concurrency: 1 }
    )
    const pages = indexed.filter((p): p is PageTokens => p !== undefined)

    const searchIndex = buildIndex(pages)

    const searchDir = path.join(input.outputDir, 'sovrium-search')
    yield* ensureDir(searchDir)

    const indexPath = path.join(searchDir, 'index.json')
    const runtimePath = path.join(searchDir, 'runtime.js')

    yield* writeJsonFile(indexPath, searchIndex)
    const runtimeJs = yield* buildRuntimeJs()
    yield* writeTextFile(runtimePath, runtimeJs)

    logDebug(`[search-index] wrote ${pages.length} page records to ${indexPath}`)

    return {
      files: ['sovrium-search/index.json', 'sovrium-search/runtime.js'],
    }
  }).pipe(Effect.withSpan('server.generate-search-index'))
