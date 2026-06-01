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
import { resolvePackagePath } from '@/infrastructure/utils/package-paths'

export interface GenerateSearchIndexInput {
  readonly inputDir: string
  readonly outputDir: string
  readonly publicPagePaths: readonly string[]
}

export interface GenerateSearchIndexResult {
  readonly files: readonly string[]
}

export class GenerateSearchIndexError extends Data.TaggedError('GenerateSearchIndexError')<{
  readonly cause: unknown
  readonly message: string
}> {}


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


const extractTitle = (html: string): string => {
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/iu.exec(html)
  if (titleMatch && titleMatch[1]) {
    return decodeHtmlEntities(titleMatch[1]).trim()
  }
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/iu.exec(html)
  if (h1Match && h1Match[1]) {
    return decodeHtmlEntities(stripTags(h1Match[1])).trim()
  }
  return ''
}

const extractSearchBodySubtree = (html: string): string | undefined => {
  const openMatch = /<([a-z][a-z0-9-]*)\b[^>]*\bdata-sovrium-search-body\b[^>]*>/iu.exec(html)
  if (!openMatch) return undefined
  const tagName = openMatch[1]?.toLowerCase()
  if (!tagName) return undefined

  const start = openMatch.index + openMatch[0].length
  const closer = new RegExp(`</${tagName}\\s*>`, 'iu')
  const closeMatch = closer.exec(html.slice(start))
  if (!closeMatch) return undefined

  return html.slice(start, start + closeMatch.index)
}

const extractBodyText = (html: string): string => {
  const source = extractSearchBodySubtree(html) ?? html

  const withoutScripts = source.replace(/<script[\s\S]*?<\/script>/giu, ' ')
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/giu, ' ')
  const withoutHead = withoutStyles.replace(/<head[\s\S]*?<\/head>/giu, ' ')
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


const fileExists = (filePath: string): Effect.Effect<boolean> =>
  Effect.tryPromise({
    try: () => fs.access(filePath).then(() => true),
    catch: () => false as const,
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

const resolveHtmlPath = (inputDir: string, pagePath: string): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    const normalized = pagePath === '/' ? '' : pagePath.replace(/^\/+/u, '')

    const candidates =
      normalized === ''
        ? [path.join(inputDir, 'index.html')]
        : [path.join(inputDir, normalized, 'index.html'), path.join(inputDir, `${normalized}.html`)]

    const checks = yield* Effect.forEach(candidates, fileExists, { concurrency: 1 })
    const hitIndex = checks.findIndex((exists) => exists)
    return hitIndex === -1 ? undefined : candidates[hitIndex]
  })


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


interface SearchIndex {
  readonly pages: readonly PageRecord[]
  readonly tokens: Readonly<Record<string, readonly TokenPosting[]>>
}

type CountMap = Readonly<Record<string, number>>

const insertionSortByScoreDesc = (postings: readonly TokenPosting[]): readonly TokenPosting[] =>
  postings.reduce<readonly TokenPosting[]>((sorted, posting) => {
    const insertAt = sorted.findIndex((existing) => existing.score < posting.score)
    return insertAt === -1
      ? [...sorted, posting]
      : [...sorted.slice(0, insertAt), posting, ...sorted.slice(insertAt)]
  }, [])

const countTokens = (tokens: readonly string[]): CountMap =>
  tokens.reduce<CountMap>((acc, token) => ({ ...acc, [token]: (acc[token] ?? 0) + 1 }), {})

const documentFrequency = (pages: readonly PageTokens[]): CountMap =>
  pages.reduce<CountMap>(
    (acc, page) =>
      [...new Set(page.tokens)].reduce<CountMap>(
        (inner, token) => ({ ...inner, [token]: (inner[token] ?? 0) + 1 }),
        acc
      ),
    {}
  )

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

  const allPostings = pages.flatMap((page) => pagePostings(page, df, totalPages))
  const groupedTokens = allPostings.reduce<Readonly<Record<string, readonly TokenPosting[]>>>(
    (acc, [token, posting]) => ({
      ...acc,
      [token]: [...(acc[token] ?? []), posting],
    }),
    {}
  )

  const sortedTokens: Record<string, readonly TokenPosting[]> = Object.fromEntries(
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
        throw new Error(`runtime.js build failed:\n${errors}`)
      }
      const output = result.outputs[0]
      if (!output) {
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


const ensureDir = (dir: string) =>
  Effect.tryPromise({
    try: () => fs.mkdir(dir, { recursive: true }),
    catch: (cause) =>
      new GenerateSearchIndexError({
        cause,
        message: `Failed to create directory ${dir}`,
      }),
  })

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
  })
