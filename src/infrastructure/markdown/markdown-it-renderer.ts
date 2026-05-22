/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import {
  escapeHtml,
  scanDirectives,
  splitFrontmatter,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/services/markdown-renderer'

interface MdToken {
  readonly type: string
  readonly tag: string
  readonly content: string
}

interface MarkdownItTokenLike extends MdToken {
  attrSet(name: string, value: string): void
}

interface RenderEnv {
  readonly codeBlocks: { lang: string; code: string }[]
  readonly directives: { name: string; attrs: Record<string, string>; innerMarkdown: string }[]
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const extractHeadings = (tokens: readonly MdToken[]): readonly MarkdownHeading[] =>
  tokens
    .map((token, idx): MarkdownHeading | undefined => {
      if (token.type !== 'heading_open') return undefined
      const level = Number(token.tag.slice(1))
      const inlineToken = tokens[idx + 1]
      const text = inlineToken?.content ?? ''
      const headingIndex = tokens.slice(0, idx).filter((t) => t.type === 'heading_open').length + 1
      const id = slugify(text) || `heading-${headingIndex}`
      return { level, id, text }
    })
    .filter((heading): heading is MarkdownHeading => heading !== undefined)

const annotateHeadingIds = (
  tokens: ReadonlyArray<MarkdownItTokenLike>,
  headings: readonly MarkdownHeading[]
): void =>
  tokens.reduce<number>((seen, token) => {
    if (token.type !== 'heading_open') return seen
    const heading = headings[seen]
    if (heading !== undefined) token.attrSet('id', heading.id)
    return seen + 1
  }, 0) as unknown as void

const DIRECTIVE_HEADER_NAME_RE = /^([a-zA-Z][a-zA-Z0-9-]*)/
const validateDirective = (params: string): boolean => DIRECTIVE_HEADER_NAME_RE.test(params.trim())

interface ContainerToken {
  readonly type: string
  readonly tag: string
  readonly nesting: number
  readonly info: string
}

const directiveRender = (tokens: ReadonlyArray<ContainerToken>, idx: number): string => {
  const token = tokens[idx]
  if (token === undefined) return ''
  if (token.nesting === 1) {
    const index =
      tokens.slice(0, idx + 1).filter((t) => t.type === 'container_directive_open').length - 1
    return `<div class="md-directive md-directive-${index}">`
  }
  return `</div>\n`
}

const createRenderer = (): MarkdownIt => {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    langPrefix: 'language-',
  })

  md.validateLink = () => true

  const ALLOWED_LINK_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', 'tel'])

  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx]
    if (!token) return ''
    const hrefIdx = token.attrIndex('href')
    if (hrefIdx >= 0) {
      const { attrs } = token
      const attr = attrs?.[hrefIdx]
      const rawHref = attr?.[1] ?? ''
      const trimmed = rawHref.trim()
      const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
      const safeHref =
        schemeMatch !== null && !ALLOWED_LINK_SCHEMES.has((schemeMatch[1] ?? '').toLowerCase())
          ? '#'
          : trimmed
      if (attr) attr[1] = safeHref
    }
    return self.renderToken(tokens, idx, options)
  }

  md.use(container, 'directive', {
    validate: validateDirective,
    render: directiveRender,
  })

  md.renderer.rules.fence = (tokens, idx, _options, env: RenderEnv) => {
    const token = tokens[idx]
    if (!token) return ''
    const info = (token.info ?? '').trim()
    const lang = info.split(/\s+/, 1)[0] ?? ''
    const code = token.content
    const index = env.codeBlocks.length
    env.codeBlocks[index] = { lang, code }
    const langAttr = lang.length > 0 ? ` class="language-${escapeHtml(lang)}"` : ''
    return `<pre><code${langAttr} data-md-code="${index}">${escapeHtml(code)}</code></pre>\n`
  }

  return md
}

const SHARED_RENDERER = createRenderer()

Object.freeze(SHARED_RENDERER.renderer.rules)

export const renderMarkdownToHtml = (source: string): RenderedMarkdown => {
  const { body, frontmatter } = splitFrontmatter(source)
  const directives = scanDirectives(body)
  const env: RenderEnv = {
    codeBlocks: [],
    directives: directives.map((d) => ({
      name: d.name,
      attrs: { ...d.attrs },
      innerMarkdown: d.innerMarkdown,
    })),
  }
  const tokens = SHARED_RENDERER.parse(body, env) as ReadonlyArray<MarkdownItTokenLike>
  const headings = extractHeadings(tokens)
  annotateHeadingIds(tokens, headings)
  const html = SHARED_RENDERER.renderer.render(
    tokens as unknown as Parameters<MarkdownIt['renderer']['render']>[0],
    SHARED_RENDERER.options,
    env
  )
  return {
    body,
    html,
    headings,
    frontmatter,
    codeBlocks: env.codeBlocks,
    directives: env.directives,
  }
}

export type {
  MarkdownHeading,
  MarkdownDirective,
  MarkdownCodeBlock,
  RenderedMarkdown,
} from '@/domain/services/markdown-renderer'
