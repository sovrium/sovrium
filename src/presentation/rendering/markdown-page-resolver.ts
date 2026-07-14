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
import { buildContentDirEditUrl } from '@/domain/utils/content-dir/content-dir-edit-url'
import { matchesContentDirFilter } from '@/domain/utils/content-dir/content-dir-filter'
import {
  buildContentDirSeoMeta,
  resolvePagePath,
  type ContentDirSeoMeta,
} from '@/domain/utils/content-dir/content-dir-seo-meta'
import { deriveContentDirSlugFromRouteParams } from '@/domain/utils/content-dir/content-dir-slug'
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
  readonly lastUpdated?: string
  readonly editUrl?: string
  readonly lang?: string
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

  const slug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
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
  const currentSlug = deriveContentDirSlugFromRouteParams(contentDir, routeParams)
  return listContentDir(contentDir, page.path, currentSlug)
}

const formatHumanDate = (input: string | Date, lang?: string): string | undefined => {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return undefined
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }
  try {
    return new Intl.DateTimeFormat(lang ?? 'en', options).format(date)
  } catch {
    return new Intl.DateTimeFormat('en', options).format(date)
  }
}

const statMtime = async (path: string): Promise<Date | undefined> => {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(getContentBaseDir(), path)
    const stats = await stat(absolutePath)
    return stats.mtime
  } catch {
    return undefined
  }
}

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

async function resolveLastUpdated(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  layout: ResolvedMarkdownPage['layout'],
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

const resolveEditUrl = (
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

const buildChromeFields = (
  editUrl: string | undefined,
  currentLang: string | undefined
): Pick<ResolvedMarkdownPage, 'editUrl' | 'lang'> => ({
  ...(editUrl !== undefined && { editUrl }),
  ...(currentLang !== undefined && { lang: currentLang }),
})

const isNonRenderableOutcome = (outcome: ContentDirOutcome): boolean =>
  outcome.kind === 'excluded' || outcome.kind === 'not-found'

export const resolveMarkdownPage = async (
  page: Page,
  routeParams: Readonly<Record<string, string>> = {},
  app?: App,
  currentLang?: string
): Promise<ResolvedMarkdownPage | undefined> => {
  const pageSourceFile = derivePageSourceFile(page)
  const contentDirOutcome = await loadContentDirSource(page, routeParams)
  if (isNonRenderableOutcome(contentDirOutcome)) {
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
  const lastUpdated = await resolveLastUpdated(
    page,
    routeParams,
    rendered.frontmatter,
    layout,
    currentLang
  )
  const editUrl = resolveEditUrl(page, routeParams, currentLang)
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
    ...(lastUpdated !== undefined && { lastUpdated }),
    ...buildChromeFields(editUrl, currentLang),
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
