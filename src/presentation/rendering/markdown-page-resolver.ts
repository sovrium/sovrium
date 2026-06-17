/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import {
  filterTocHeadings,
  splitFrontmatter,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/services/markdown/markdown-renderer'
import { matchesContentDirFilter } from '@/domain/utils/content-dir/content-dir-filter'
import {
  buildContentDirSeoMeta,
  resolvePagePath,
  type ContentDirSeoMeta,
} from '@/domain/utils/content-dir/content-dir-seo-meta'
import {
  buildContentDirStructuredData,
  parseStructuredDataConfig,
} from '@/domain/utils/content-dir/content-dir-structured-data'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { renderMarkdownToHtml } from '@/infrastructure/markdown/markdown-it-renderer'
import { highlightCodeBlocks } from '@/infrastructure/markdown/shiki-highlighter'
import { getContentBaseDir } from '@/presentation/rendering/content-base-dir'
import { listContentDir, type CollectionNavData } from '@/presentation/rendering/content-dir-lister'
import { spliceMarkdownDirectives } from '@/presentation/rendering/markdown-directives'
import { resolveMarkdownTranslations } from '@/presentation/rendering/markdown-i18n'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { Markdown } from '@/domain/models/app/pages/markdown'


export interface ResolvedMarkdownPage {
  readonly html: string
  readonly layout: 'prose' | 'docs' | 'full' | 'none'
  readonly tocHeadings?: readonly MarkdownHeading[]
  readonly tocPosition?: 'top' | 'sidebar'
  readonly frontmatter: Readonly<Record<string, string>>
  readonly collectionNav?: CollectionNavData
  readonly seo?: ContentDirSeoMeta
}

const DEFAULT_LAYOUT = 'prose' as const
const DEFAULT_TOC_MAX_DEPTH = 3
const DEFAULT_TOC_POSITION = 'top' as const

const readMarkdownFile = async (path: string): Promise<string | undefined> => {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(getContentBaseDir(), path)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    return await file.text()
  } catch {
    return undefined
  }
}

const contentDirExists = async (directory: string): Promise<boolean> => {
  const absolutePath = isAbsolute(directory) ? directory : resolve(getContentBaseDir(), directory)
  return stat(absolutePath)
    .then((stats) => stats.isDirectory())
    .catch(() => false)
}

const loadMarkdownSource = async (
  markdown: Markdown,
  pageSourceFile: string | undefined
): Promise<string> => {
  if (typeof markdown.content === 'string') return markdown.content
  if (typeof markdown.file === 'string') {
    const fileContent = await readMarkdownFile(markdown.file)
    return fileContent ?? ''
  }
  if (typeof pageSourceFile === 'string') {
    const fileContent = await readMarkdownFile(pageSourceFile)
    return fileContent ?? ''
  }
  return ''
}

const buildToc = (
  rendered: RenderedMarkdown,
  toc: Markdown['toc']
): { headings: readonly MarkdownHeading[]; position: 'top' | 'sidebar' } | undefined => {
  if (toc === undefined) return undefined
  const maxDepth = toc.maxDepth ?? DEFAULT_TOC_MAX_DEPTH
  const position = toc.position ?? DEFAULT_TOC_POSITION
  return { headings: filterTocHeadings(rendered.headings, maxDepth), position }
}

const isMarkdownFile = (path: string): boolean => path.toLowerCase().endsWith('.md')

const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

const deriveContentDirSlug = (
  contentDir: ContentDir,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  const values = Object.entries(routeParams)
    .filter(([key, v]) => key !== 'lang' && typeof v === 'string' && v.length > 0)
    .map(([, v]) => v)
  if (values.length === 0) return undefined
  if (contentDir.slugFrom === 'filepath') {
    return stripLeadingSlash(values.join('/'))
  }
  const first = values[0]
  return first === undefined ? undefined : stripLeadingSlash(first)
}

const hasContentDirFilter = (contentDir: ContentDir): boolean =>
  contentDir.filter !== undefined && Object.keys(contentDir.filter).length > 0

type ContentDirOutcome =
  | { readonly kind: 'no-source' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'excluded' }
  | { readonly kind: 'source'; readonly body: string }

const loadContentDirSource = async (
  page: Page,
  routeParams: Readonly<Record<string, string>>
): Promise<ContentDirOutcome> => {
  const { contentDir } = page
  if (contentDir === undefined) return { kind: 'no-source' }

  const slug = deriveContentDirSlug(contentDir, routeParams)
  const filterActive = hasContentDirFilter(contentDir)

  if (slug === undefined) {
    return filterActive ? { kind: 'excluded' } : { kind: 'source', body: '' }
  }

  const directory = contentDir.directory.replace(/\/+$/, '')
  const filePath = `${directory}/${slug}.md`
  const fileContent = await readMarkdownFile(filePath)

  if (fileContent === undefined) {
    if (filterActive) return { kind: 'not-found' }
    return (await contentDirExists(directory))
      ? { kind: 'not-found' }
      : { kind: 'source', body: '' }
  }

  if (filterActive) {
    const { frontmatter } = splitFrontmatter(fileContent)
    if (!matchesContentDirFilter(contentDir.filter, frontmatter)) {
      return { kind: 'not-found' }
    }
  }

  return { kind: 'source', body: fileContent }
}

const derivePageSourceFile = (page: Page): string | undefined =>
  typeof page.source?.file === 'string' && isMarkdownFile(page.source.file)
    ? page.source.file
    : undefined

const pickMarkdownSource = async (
  contentDirOutcome: ContentDirOutcome,
  markdown: Markdown,
  pageSourceFile: string | undefined
): Promise<string> => {
  if (contentDirOutcome.kind === 'source') return contentDirOutcome.body
  return loadMarkdownSource(markdown, pageSourceFile)
}

const hasNoMarkdownTrigger = (
  contentDirOutcome: ContentDirOutcome,
  page: Page,
  pageSourceFile: string | undefined
): boolean =>
  contentDirOutcome.kind === 'no-source' && !page.markdown && pageSourceFile === undefined

const composeMarkdownHtml = async (
  rendered: ReturnType<typeof renderMarkdownToHtml>,
  app: App | undefined
): Promise<string> => {
  const codeBlockTheme = app?.theme?.codeBlock?.theme
  const highlightedHtml = await highlightCodeBlocks(
    rendered.html,
    rendered.codeBlocks,
    codeBlockTheme
  )
  const sanitizedHtml = sanitizeRichTextHTML(highlightedHtml)
  return spliceMarkdownDirectives(sanitizedHtml, rendered.directives, app?.theme)
}

const localiseMarkdownSource = (
  source: string,
  app: App | undefined,
  currentLang: string | undefined
): string =>
  resolveMarkdownTranslations(source, currentLang ?? app?.languages?.default, app?.languages)

const buildCollectionNav = async (
  page: Page,
  routeParams: Readonly<Record<string, string>>
): Promise<CollectionNavData | undefined> => {
  const { contentDir } = page
  if (contentDir === undefined) return undefined
  if (contentDir.nav?.enabled !== true) return undefined
  const currentSlug = deriveContentDirSlug(contentDir, routeParams)
  return listContentDir(contentDir, page.path, currentSlug)
}

export const resolveMarkdownPage = async (
  page: Page,
  routeParams: Readonly<Record<string, string>> = {},
  app?: App,
  currentLang?: string
): Promise<ResolvedMarkdownPage | undefined> => {
  const pageSourceFile = derivePageSourceFile(page)
  const contentDirOutcome = await loadContentDirSource(page, routeParams)
  if (contentDirOutcome.kind === 'excluded' || contentDirOutcome.kind === 'not-found') {
    return undefined
  }
  if (hasNoMarkdownTrigger(contentDirOutcome, page, pageSourceFile)) return undefined
  const markdown: Markdown = page.markdown ?? {}
  const source = await pickMarkdownSource(contentDirOutcome, markdown, pageSourceFile)
  const localisedSource = localiseMarkdownSource(source, app, currentLang)
  const rendered = renderMarkdownToHtml(localisedSource)
  const composedHtml = await composeMarkdownHtml(rendered, app)
  const toc = buildToc(rendered, markdown.toc)
  const layout = markdown.layout ?? DEFAULT_LAYOUT
  const collectionNav = await buildCollectionNav(page, routeParams)
  const seo = buildContentDirSeo(page, routeParams, rendered.frontmatter, app)
  return {
    html: composedHtml,
    layout,
    ...(toc !== undefined && {
      tocHeadings: toc.headings,
      tocPosition: toc.position,
    }),
    frontmatter: rendered.frontmatter,
    ...(collectionNav !== undefined && { collectionNav }),
    ...(seo !== undefined && { seo }),
  }
}

const buildContentDirSeo = (
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  app: App | undefined
): ContentDirSeoMeta | undefined => {
  if (page.contentDir === undefined) return undefined
  const baseUrl = typeof Bun.env.BASE_URL === 'string' ? Bun.env.BASE_URL : undefined
  return buildContentDirSeoMeta({
    pattern: page.path,
    routeParams,
    frontmatter,
    languages: app?.languages,
    baseUrl,
    structuredData: buildContentDirSynthesisedJsonLd(page, routeParams, frontmatter, baseUrl),
  })
}

const buildContentDirSynthesisedJsonLd = (
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  baseUrl: string | undefined
): readonly Record<string, unknown>[] => {
  if (page.meta?.schema !== undefined) return []
  const config = parseStructuredDataConfig(page.meta?.structuredData)
  if (config === undefined) return []
  const resolvedPath = resolvePagePath(page.path, routeParams)
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${resolvedPath}` : resolvedPath
  return buildContentDirStructuredData({
    config,
    frontmatter,
    url,
    groupBy: page.contentDir?.nav?.groupBy,
  })
}

export const isContentDirSlugNotFound = async (
  page: Page,
  routeParams: Readonly<Record<string, string>> = {}
): Promise<boolean> => {
  if (page.contentDir === undefined) return false
  const outcome = await loadContentDirSource(page, routeParams)
  return outcome.kind === 'not-found'
}
