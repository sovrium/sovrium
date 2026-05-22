/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAbsolute, resolve } from 'node:path'
import {
  filterTocHeadings,
  splitFrontmatter,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/services/markdown-renderer'
import { matchesContentDirFilter } from '@/domain/utils/content-dir-filter'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { renderMarkdownToHtml } from '@/infrastructure/markdown/markdown-it-renderer'
import { highlightCodeBlocks } from '@/infrastructure/markdown/shiki-highlighter'
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
}

const DEFAULT_LAYOUT = 'prose' as const
const DEFAULT_TOC_MAX_DEPTH = 3
const DEFAULT_TOC_POSITION = 'top' as const

const readMarkdownFile = async (path: string): Promise<string | undefined> => {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    return await file.text()
  } catch {
    return undefined
  }
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
  const values = Object.values(routeParams).filter((v) => typeof v === 'string' && v.length > 0)
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

  const filePath = `${contentDir.directory.replace(/\/+$/, '')}/${slug}.md`
  const fileContent = await readMarkdownFile(filePath)

  if (fileContent === undefined) {
    return filterActive ? { kind: 'excluded' } : { kind: 'source', body: '' }
  }

  if (filterActive) {
    const { frontmatter } = splitFrontmatter(fileContent)
    if (!matchesContentDirFilter(contentDir.filter, frontmatter)) {
      return { kind: 'excluded' }
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
  if (contentDirOutcome.kind === 'excluded') return undefined
  if (hasNoMarkdownTrigger(contentDirOutcome, page, pageSourceFile)) return undefined
  const markdown: Markdown = page.markdown ?? {}
  const source = await pickMarkdownSource(contentDirOutcome, markdown, pageSourceFile)
  const localisedSource = localiseMarkdownSource(source, app, currentLang)
  const rendered = renderMarkdownToHtml(localisedSource)
  const composedHtml = await composeMarkdownHtml(rendered, app)
  const toc = buildToc(rendered, markdown.toc)
  const layout = markdown.layout ?? DEFAULT_LAYOUT
  const collectionNav = await buildCollectionNav(page, routeParams)
  return {
    html: composedHtml,
    layout,
    ...(toc !== undefined && {
      tocHeadings: toc.headings,
      tocPosition: toc.position,
    }),
    frontmatter: rendered.frontmatter,
    ...(collectionNav !== undefined && { collectionNav }),
  }
}
