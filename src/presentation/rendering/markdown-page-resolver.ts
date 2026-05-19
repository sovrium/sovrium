/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAbsolute, resolve } from 'node:path'
import {
  filterTocHeadings,
  renderMarkdownToHtml,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/services/markdown-renderer'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { Markdown } from '@/domain/models/app/pages/markdown'


export interface ResolvedMarkdownPage {
  readonly html: string
  readonly layout: 'prose' | 'docs' | 'full'
  readonly tocHeadings?: readonly MarkdownHeading[]
  readonly tocPosition?: 'top' | 'sidebar'
  readonly frontmatter: Readonly<Record<string, string>>
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

const matchesContentDirFilter = (
  contentDir: ContentDir,
  frontmatter: Readonly<Record<string, string>>
): boolean => {
  const { filter } = contentDir
  if (filter === undefined) return true
  return Object.entries(filter).every(([key, expected]) => {
    const actual = frontmatter[key]
    if (typeof expected === 'boolean') {
      const actualIsTrue = actual === 'true'
      return expected === actualIsTrue
    }
    return actual === String(expected)
  })
}

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
    const probe = renderMarkdownToHtml(fileContent)
    if (!matchesContentDirFilter(contentDir, probe.frontmatter)) {
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

export const resolveMarkdownPage = async (
  page: Page,
  routeParams: Readonly<Record<string, string>> = {}
): Promise<ResolvedMarkdownPage | undefined> => {
  const pageSourceFile = derivePageSourceFile(page)
  const contentDirOutcome = await loadContentDirSource(page, routeParams)
  if (contentDirOutcome.kind === 'excluded') return undefined
  if (hasNoMarkdownTrigger(contentDirOutcome, page, pageSourceFile)) return undefined
  const markdown: Markdown = page.markdown ?? {}
  const source = await pickMarkdownSource(contentDirOutcome, markdown, pageSourceFile)
  const rendered = renderMarkdownToHtml(source)
  const toc = buildToc(rendered, markdown.toc)
  const layout = markdown.layout ?? DEFAULT_LAYOUT
  return {
    html: rendered.html,
    layout,
    ...(toc !== undefined && {
      tocHeadings: toc.headings,
      tocPosition: toc.position,
    }),
    frontmatter: rendered.frontmatter,
  }
}
