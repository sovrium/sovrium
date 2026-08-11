/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Markdown -> HTML renderer backed by `markdown-it` (CommonMark + GFM) plus
 * `markdown-it-container` for the `:::name [attrs]:::` directive syntax.
 *
 * Lives in the infrastructure layer because `markdown-it` is a side-effectful
 * HTML rendering library: it mutates `renderer.rules`, `validateLink`, and the
 * per-render token stream (via `attrSet`). The pure data shapes
 * (`MarkdownHeading`, `MarkdownDirective`, `MarkdownCodeBlock`,
 * `RenderedMarkdown`) plus pure helpers (`splitFrontmatter`, `scanDirectives`,
 * `filterTocHeadings`, `slugify`, `escapeHtml`, `parseDirectiveHeader`) stay
 * in `src/domain/services/markdown/markdown-renderer.ts` — those are pure string
 * transforms with no library dependency.
 *
 * Renderer configuration:
 *
 *  - `html: false`     → author raw HTML is dropped at parse time. Combined
 *    with the canonical `sanitizeRichTextHTML` upstream this preserves the
 * [internal ref] XSS guarantee under the new engine.
 *  - `linkify: true`   → bare URLs in body text autolink to `<a href=...>`
 * (GFM-style autolinks — [internal ref]).
 *  - `breaks: false`   → CommonMark default; single line breaks do not become
 * `<br>` (matches the established [internal ref] authoring expectation).
 *  - `langPrefix: 'language-'` → fenced code blocks emit
 *    `<pre><code class="language-x">` ready for Shiki (cluster 2) to splice in.
 *
 * SECURITY: This file is the SINGLE sanctioned site for mutating
 * `md.validateLink` and `md.renderer.rules.{link_open, fence}`. The custom
 * `link_open` rule below is the ONLY allowlist for link schemes — markdown-it's
 * default `validateLink` is widened (`= () => true`) so the anchor always
 * renders with `href="#"` for blocked schemes instead of being dropped. Any new
 * mutation to these hooks MUST be added here; per-call link policy is NOT
 * supported (the shared `SHARED_RENDERER` is reused across renders).
 */

import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import {
  escapeHtml,
  scanDirectives,
  splitFrontmatter,
  type MarkdownHeading,
  type RenderedMarkdown,
} from '@/domain/services/markdown/markdown-renderer'
import { parseFenceInfo } from '@/domain/utils/code-frame-defaults'

/**
 * Minimal structural shape of a markdown-it token used by `extractHeadings`.
 * Kept local to this module so we do not depend on markdown-it's `Token`
 * type (which is mutable by design — its public extension API).
 */
interface MdToken {
  readonly type: string
  readonly tag: string
  readonly content: string
}

/**
 * Minimal mutation-permitting view of a markdown-it `Token`. We deliberately
 * restrict this to the single method the renderer needs.
 */
interface MarkdownItTokenLike extends MdToken {
  attrSet(name: string, value: string): void
}

/**
 * Per-render env passed through the markdown-it token stream so the custom
 * `fence` renderer can populate a mutable `codeBlocks[]` buffer without
 * mutating the shared renderer's `rules` map (which would leak state across
 * concurrent renders). The buffer is allocated fresh per `renderMarkdownToHtml`
 * call and read back into the returned `RenderedMarkdown` payload after
 * rendering completes.
 */
interface RenderEnv {
  readonly codeBlocks: { lang: string; code: string }[]
  readonly directives: { name: string; attrs: Record<string, string>; innerMarkdown: string }[]
}

/**
 * Walk markdown-it's parsed token stream and derive `{ id, level, text }`
 * for every `heading_open` token. Pure: no I/O, no mutation of inputs.
 *
 * markdown-it represents a heading as three consecutive tokens:
 *   `heading_open` → `inline` (whose `.content` is the rendered text) →
 *   `heading_close`. The slug is derived from the inline content; an empty
 *   slug falls back to `heading-N` (matching the historical renderer).
 */
/**
 * Slugify a heading's text into the anchor `id` used on the rendered page.
 *
 * Exported so non-render consumers (e.g. the RSS feed builder for a single
 * `markdown: { file }` changelog page) can compute the SAME `#fragment` the
 * on-page `<h2 id="...">` anchor uses, guaranteeing a feed link deep-links to
 * the exact release section. This is the single source of truth for anchor
 * slugs — do not duplicate the transform elsewhere.
 */
export const slugify = (value: string): string =>
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
      // The index here is across ALL tokens, so we use a 1-based count of
      // preceding heading_open tokens for the fallback slug (matches the
      // historical "Nth heading on the page" semantics).
      const headingIndex = tokens.slice(0, idx).filter((t) => t.type === 'heading_open').length + 1
      const id = slugify(text) || `heading-${headingIndex}`
      return { level, id, text }
    })
    .filter((heading): heading is MarkdownHeading => heading !== undefined)

/**
 * Inject `id="<slug>"` into every `heading_open` token. markdown-it's token
 * stream IS its public extension contract (renderer rules, plugins, and
 * core_ruler all mutate tokens), so `attrSet` is the framework-correct path;
 * the mutation is confined to per-render tokens that never escape this
 * function. Implemented via `reduce` to keep the FP ESLint rules happy
 * without disabling them — the accumulator tracks how many heading-opens we
 * have seen so far so the slug we apply matches the parallel headings array.
 */
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

/**
 * Validator for the `directive` container: accepts any block whose header
 * begins with a kebab-case identifier (mirrors the domain's
 * `DIRECTIVE_HEADER_NAME_RE`). Unknown directive names still match — the
 * post-sanitisation splicer degrades unknown names to inline-rendered inner
 * markdown.
 */
const DIRECTIVE_HEADER_NAME_RE = /^([a-zA-Z][a-zA-Z0-9-]*)/
const validateDirective = (params: string): boolean => DIRECTIVE_HEADER_NAME_RE.test(params.trim())

/**
 * Render hook for the `directive` container. Emits a placeholder
 * `<div class="md-directive md-directive-<N>">` that the canonical sanitiser
 * passes through unchanged (only `class` is allowed on `*`, and the class name
 * has no quotes/whitespace that would alarm the parser). The inner content of
 * the directive is rendered inline by markdown-it's normal block tokeniser as
 * the placeholder's children.
 *
 * Directive metadata (name, attrs, raw inner source) lives in `env.directives`,
 * populated by `scanDirectives` BEFORE markdown-it parses the source. The
 * indices line up because both this hook and `scanDirectives` walk the source
 * in document order.
 *
 * The render hook is shared between open and close tokens — it inspects
 * `nesting` (1 = open, -1 = close) to emit the right tag.
 */
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
    // Count how many directive-open tokens we've seen up to and including
    // this one — that's the index into env.directives (which was populated
    // in document order by scanDirectives).
    const index =
      tokens.slice(0, idx + 1).filter((t) => t.type === 'container_directive_open').length - 1
    // The directive name we'd use for `data-md-directive` (debug only) is
    // stripped by the sanitiser anyway — the post-sanitiser splicer reads
    // the name from env.directives[index].name, so we don't emit it here.
    return `<div class="md-directive md-directive-${index}">`
  }
  return `</div>\n`
}

/**
 * Build the shared markdown-it instance. A single instance is reused across
 * renders — markdown-it is render-state-free; per-render state lives in the
 * `env` object threaded through `parse`/`render` (see `RenderEnv`).
 */
const createRenderer = (): MarkdownIt => {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    langPrefix: 'language-',
  })

  // Link-scheme allowlist. markdown-it's default
  // `validateLink` rejects `javascript:`/`data:`/`vbscript:` by DROPPING the
  // anchor entirely, but the historical Sovrium contract is to render the
  // link with `href="#"` so authors see the broken link instead of silently
  // losing the anchor text. Override `validateLink` to be permissive (the
  // anchor always renders) and rewrite the href in `link_open` below.
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- markdown-it exposes `validateLink` as a mutable hook on the instance; per-renderer config, not shared state
  md.validateLink = () => true

  const ALLOWED_LINK_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', 'tel'])

  // markdown-it's renderer.rules signature is fixed at (tokens, idx, options,
  // env, self) => string — 5 params imposed by the library, exceeds the
  // project's max-params: 4 lint cap.
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, max-params -- renderer.rules IS markdown-it's plugin contract; signature is library-imposed
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
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- per-render token mutation, never escapes
      if (attr) attr[1] = safeHref
    }
    return self.renderToken(tokens, idx, options)
  }

  // Register the catch-all `directive` container plugin. The `validate` hook
  // accepts any kebab-case identifier; the `render` hook emits a placeholder
  // div the canonical sanitiser preserves (see `directiveRender`).
  // eslint-disable-next-line functional/no-expression-statements -- md.use() is markdown-it's standard plugin registration; mutation is internal to the shared renderer build, not exposed
  md.use(container, 'directive', {
    validate: validateDirective,
    render: directiveRender,
  })

  // Replace the default fence renderer with one that emits a
  // `<pre><code class="language-X" data-md-code="N">…</code></pre>` placeholder
  // and records the raw source in `env.codeBlocks[N]`. The presentation layer
  // then splices Shiki-tokenised HTML into the placeholder; if no highlighter
  // runs, the escaped source already inside the placeholder renders as plain
  // pre/code — never blank.
  //
  // Codeblock buffer is grown via index-assign (`array[length] = item`) rather
  // than `array.push()` because the FP ESLint rule bans `.push()` — index
  // assignment is the project-blessed pattern for in-place buffer accumulation
  // (see other renderer/streaming sites in src/).
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- markdown-it's `renderer.rules` IS its plugin contract; per-renderer mutation, not shared state
  md.renderer.rules.fence = (tokens, idx, _options, env: RenderEnv) => {
    const token = tokens[idx]
    if (!token) return ''
    // The first whitespace-delimited word is the language tag; the rest of the
    // info string is meta. `title=` / `filename=` is read out of that meta and
    // carried on the code block, because it is what the fence's header shows
    // when the language-derived default over-claims.
    // Until this parse existed, everything past the language tag was DISCARDED
    // here, so `title=` could never reach the renderer that needed it.
    const { lang, title } = parseFenceInfo(token.info ?? '')
    // markdown-it stores fence content WITH a trailing newline (the newline
    // preceding the closing fence line). Left verbatim, Shiki renders that as an
    // empty trailing line inside `pre.shiki`, adding stray bottom space to every
    // code block. Strip exactly ONE trailing newline so the highlighted block
    // ends on its last real line. Interior blank lines are preserved.
    const code = token.content.replace(/\n$/, '')
    const index = env.codeBlocks.length
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- per-render buffer, never escapes the call
    env.codeBlocks[index] = { lang, code, ...(title === undefined ? {} : { title }) }
    const langAttr = lang.length > 0 ? ` class="language-${escapeHtml(lang)}"` : ''
    return `<pre><code${langAttr} data-md-code="${index}">${escapeHtml(code)}</code></pre>\n`
  }

  return md
}

const SHARED_RENDERER = createRenderer()

// Runtime guard: freeze the renderer's rules table AFTER createRenderer() has
// installed our `link_open` and `fence` overrides plus the `directive`
// container plugin. Any future code that attempts to decorate or replace a
// renderer rule from outside this module (e.g. via the imported SHARED_RENDERER)
// will throw in strict mode rather than silently bypass the link-scheme
// allowlist. This complements the SECURITY notice at the top of the file —
// the comment tells future contributors WHY they should not mutate; the
// freeze prevents accidental mutation if they ignore the comment. The cost is
// negligible (one Object.freeze at module load).
// eslint-disable-next-line functional/no-expression-statements -- one-time freeze at module load is the intended runtime guard
Object.freeze(SHARED_RENDERER.renderer.rules)

/**
 * Render a markdown source string into HTML, with frontmatter and headings.
 *
 * The output `html` is safe to interpolate into a server-rendered React tree
 * via `dangerouslySetInnerHTML` because markdown-it runs with `html: false`
 * (raw author HTML is dropped at parse time). The full composed page HTML
 * still passes through the canonical `sanitizeRichTextHTML` in the
 * presentation layer for defense in depth.
 */
export const renderMarkdownToHtml = (source: string): RenderedMarkdown => {
  const { body, frontmatter } = splitFrontmatter(source)
  // Two-phase: parse → derive headings (pure) + annotate ids → render.
  // Splitting parse from render lets us extract heading metadata immutably
  // and keeps the renderer rules registry free of per-render side effects.
  // The render env carries a mutable `codeBlocks` buffer for the custom
  // fence renderer; it is reset per call so concurrent renders cannot share
  // state via the shared renderer instance. Directive metadata is pre-scanned
  // from the raw body so the inner markdown is preserved verbatim (the
  // markdown-it-container plugin tokenises the inner content for rendering
  // but does not give us a clean hook on raw source — see `scanDirectives`).
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

// Re-export the pure types from domain so consumers can import either path.
// The CANONICAL import path for these types is `@/domain/services/markdown/markdown-renderer`;
// these re-exports exist so a single import of the infrastructure renderer is
// enough for typical consumer files.
export type {
  MarkdownHeading,
  MarkdownDirective,
  MarkdownCodeBlock,
  RenderedMarkdown,
} from '@/domain/services/markdown/markdown-renderer'
