/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Markdown rendering — DOMAIN PIECES (pure data + pure helpers).
 *
 * This module is intentionally pure (Domain layer): no I/O, no Effect
 * dependencies, no `markdown-it` import. The `markdown-it`-backed renderer
 * lives in `src/infrastructure/markdown/markdown-it-renderer.ts` because
 * `markdown-it` is a side-effectful HTML rendering library (mutable
 * `renderer.rules`, mutable `attrSet`, the `validateLink` override).
 *
 * What stays here:
 *   - Pure data types: `MarkdownHeading`, `MarkdownDirective`,
 *     `MarkdownCodeBlock`, `RenderedMarkdown`.
 *   - Pure transforms: `splitFrontmatter`, `scanDirectives`,
 *     `filterTocHeadings`, `escapeHtml`, `parseDirectiveHeader`.
 *
 * What moved to infrastructure:
 *   - `renderMarkdownToHtml(source)` — the rendering entry point. Consumers
 *     should import it from `@/infrastructure/markdown/markdown-it-renderer`.
 *   - `createRenderer()`, `SHARED_RENDERER`, the `link_open` / `fence` /
 *     directive renderer rule mutations.
 *
 * Frontmatter is intentionally NOT delegated to markdown-it: Sovrium's
 * `$frontmatter.*` substitution only needs YAML scalars, the splitter is
 * trivially small, and keeping it here avoids pulling in a markdown-it
 * front-matter plugin. The infrastructure renderer feeds only the
 * post-frontmatter body to markdown-it.
 */

/**
 * A single heading entry extracted from rendered markdown.
 */
export interface MarkdownHeading {
  readonly level: number
  readonly id: string
  readonly text: string
}

/**
 * A single container directive (`::: name [attrs]\n...\n:::`) extracted from
 * the markdown source — backed by `markdown-it-container` plus a pre-scan that
 * captures the raw inner source so the presentation layer can re-render the
 * directive's content as either block-level (callout body) or inline (CTA
 * button label) without re-tokenising the whole document.
 *
 * Each placeholder element in the rendered HTML is keyed by its class
 * `md-directive-<index>` — a sanitiser-safe identifier (the canonical
 * `sanitizeRichTextHTML` allowlist keeps `class` on every tag).
 */
export interface MarkdownDirective {
  /** Directive name as it appeared after `:::` (e.g. `'callout'`, `'cta'`). */
  readonly name: string
  /** Parsed `key="value"` attributes from the directive header. */
  readonly attrs: Readonly<Record<string, string>>
  /** Raw markdown source between the opening/closing `:::` fences. */
  readonly innerMarkdown: string
}

/**
 * A single fenced code-block extracted from rendered markdown.
 *
 * The renderer emits placeholder `<pre><code class="language-X" data-md-code="N">`
 * elements and populates `codeBlocks[N]` with the raw source — the
 * presentation layer (`markdown-page-resolver`) then asks the infrastructure
 * Shiki highlighter to splice tokenised HTML into the placeholders. Keeping
 * the source out-of-band of the HTML preserves the domain renderer's
 * pure/synchronous contract while still giving Shiki the verbatim text.
 */
export interface MarkdownCodeBlock {
  /** Info-string language tag (`'typescript'`, `''` for tagless fences). */
  readonly lang: string
  /** Raw, unescaped fenced source — exactly what the author typed. */
  readonly code: string
  /**
   * Explicit header text from the fence's `title=` / `filename=` meta, when the
   * author wrote one. Absent otherwise, in which case the presentation layer
   * derives a header from `lang` (`resolveDefaultCodeFrame`). This is the escape
   * hatch for a fence whose language-derived default over-claims: a YAML
   * *fragment* headed `app.yaml` tells the reader to replace their config rather
   * than extend it.
   */
  readonly title?: string
}

/**
 * Result of rendering a markdown source string.
 */
export interface RenderedMarkdown {
  /** Sanitised markdown body (without the YAML frontmatter block). */
  readonly body: string
  /** Generated HTML (already escaped where necessary). */
  readonly html: string
  /** Headings extracted from the body, in document order. */
  readonly headings: readonly MarkdownHeading[]
  /** Frontmatter as a flat record of strings (YAML scalars only). */
  readonly frontmatter: Readonly<Record<string, string>>
  /**
   * Fenced code-blocks (one entry per `<pre><code data-md-code="N">`
   * placeholder in `html`, indexed by `N`). The presentation layer feeds
   * these to the Shiki highlighter; if highlighting is not run the
   * placeholders already contain escaped source text and render as a plain
   * `<pre><code>` block.
   */
  readonly codeBlocks: readonly MarkdownCodeBlock[]
  /**
   * Container directives (one entry per `<div class="md-directive md-directive-N">`
   * placeholder in `html`, indexed by `N`). The presentation layer reads each
   * entry's `innerMarkdown` and SSR-renders the mapped component (alert, button,
   * icon, code-block chrome), splicing the result into the placeholder AFTER
   * the canonical sanitiser has run — placeholders are sanitiser-safe (only
   * `class` survives), so the splice happens post-sanitisation to preserve the
   * `role`/`data-component` attributes the components need.
   */
  readonly directives: readonly MarkdownDirective[]
}

const FRONTMATTER_FENCE = '---'

/**
 * Strip the leading YAML frontmatter block (between `---` fences) and parse
 * its scalar values into a plain record. Block-style YAML (lists, nested
 * mappings) is intentionally not supported — the markdown user story only
 * uses scalar values for `$frontmatter.*` substitution.
 */
export const splitFrontmatter = (
  source: string
): { readonly body: string; readonly frontmatter: Readonly<Record<string, string>> } => {
  const lines = source.split(/\r?\n/)
  if (lines.length === 0 || lines[0]?.trim() !== FRONTMATTER_FENCE) {
    return { body: source, frontmatter: {} }
  }
  const closingIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === FRONTMATTER_FENCE)
  if (closingIndex === -1) {
    return { body: source, frontmatter: {} }
  }
  const fmLines = lines.slice(1, closingIndex)
  const frontmatter = fmLines.reduce<Record<string, string>>((acc, raw) => {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return acc
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx <= 0) return acc
    const key = trimmed.slice(0, colonIdx).trim()
    const valueRaw = trimmed.slice(colonIdx + 1).trim()
    const value = valueRaw.replace(/^['"]|['"]$/g, '')
    return { ...acc, [key]: value }
  }, {})
  const body = lines.slice(closingIndex + 1).join('\n')
  return { body, frontmatter }
}

/**
 * Directive-header regex: matches `name` (kebab-case identifier) followed by
 * optional whitespace-separated `key="value"` attributes. Tolerant of trailing
 * whitespace.
 *
 * Examples that match:
 *   `callout`
 *   `icon name="check"`
 *   `code-block lang="ts" filename="foo.ts"`
 */
const DIRECTIVE_HEADER_NAME_RE = /^([a-zA-Z][a-zA-Z0-9-]*)/
const DIRECTIVE_ATTR_RE = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/g

export const parseDirectiveHeader = (
  raw: string
): { readonly name: string; readonly attrs: Readonly<Record<string, string>> } | undefined => {
  const trimmed = raw.trim()
  const nameMatch = DIRECTIVE_HEADER_NAME_RE.exec(trimmed)
  if (nameMatch === null) return undefined
  const name = nameMatch[1]
  if (name === undefined) return undefined
  const rest = trimmed.slice(name.length)
  const attrs: Record<string, string> = {}
  // eslint-disable-next-line functional/no-loop-statements -- regex /g iteration is the FP-idiomatic way to walk a global match; reduce-over-matchAll allocates an array per call
  for (const match of rest.matchAll(DIRECTIVE_ATTR_RE)) {
    const key = match[1]
    const value = match[2]
    if (key !== undefined && value !== undefined) {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- per-call accumulator object; never escapes parseDirectiveHeader
      attrs[key] = value
    }
  }
  return { name, attrs }
}

/**
 * Pre-scan the markdown source for `::: name [attrs]\n...\n:::` blocks and
 * extract the raw inner markdown verbatim. Runs BEFORE markdown-it tokenisation
 * so the inner source is preserved exactly as the author typed it (vs.
 * reconstructed from a rendered token stream). The result is appended to
 * `env.directives` in document order so the container plugin's `render` hook
 * (which fires during tokenisation) can index into the same array.
 *
 * Why a pre-scan instead of reading inner source inside the container plugin:
 * the plugin's `render` hook fires for open/close tokens but not for the inner
 * content (that streams through the normal block tokeniser); recovering raw
 * source from inside the plugin's `validate` hook requires accessing
 * `state.src`/`state.bMarks` which are private. A pre-scan with the same fence
 * shape (`/^:::\s*\S+/` ... `^:::\s*$`) is trivially small, runs once per
 * render, and keeps the inner source verbatim.
 */
type CollectedDirective = {
  readonly name: string
  readonly attrs: Readonly<Record<string, string>>
  readonly innerMarkdown: string
}
type ScanCurrent = {
  readonly name: string
  readonly attrs: Readonly<Record<string, string>>
  readonly lines: readonly string[]
}
type ScanState = {
  readonly collected: readonly CollectedDirective[]
  readonly current: ScanCurrent | undefined
}

/**
 * Handle one line while OUTSIDE a directive. Returns the (unchanged) state
 * when the line is not an opening `:::`, or transitions to an open-directive
 * state when it is.
 */
const handleOpeningLine = (state: ScanState, trimmed: string): ScanState => {
  const openMatch = /^:::\s*(.+?)\s*$/.exec(trimmed)
  if (openMatch === null) return state
  const header = openMatch[1]
  if (header === undefined) return state
  const parsed = parseDirectiveHeader(header)
  if (parsed === undefined) return state
  return {
    collected: state.collected,
    current: { name: parsed.name, attrs: parsed.attrs, lines: [] },
  }
}

/**
 * Handle one line while INSIDE a directive. A bare `:::` closes the
 * directive (emits a collected entry); any other line is accumulated
 * verbatim as part of the inner markdown.
 */
const handleInnerLine = (
  state: ScanState,
  trimmed: string,
  line: string,
  current: ScanCurrent
): ScanState => {
  if (trimmed === ':::') {
    return {
      collected: [
        ...state.collected,
        { name: current.name, attrs: current.attrs, innerMarkdown: current.lines.join('\n') },
      ],
      current: undefined,
    }
  }
  return {
    collected: state.collected,
    current: { name: current.name, attrs: current.attrs, lines: [...current.lines, line] },
  }
}

/**
 * Pre-scan helper described at length on the `MarkdownDirective` type.
 * Reduces the line stream with `handleOpeningLine` / `handleInnerLine` so
 * each handler stays small enough to pass the ESLint `max-lines-per-function`
 * threshold.
 */
export const scanDirectives = (source: string): readonly CollectedDirective[] => {
  const lines = source.split(/\r?\n/)
  const finalState = lines.reduce<ScanState>(
    (state, line) => {
      const trimmed = line.trim()
      return state.current === undefined
        ? handleOpeningLine(state, trimmed)
        : handleInnerLine(state, trimmed, line, state.current)
    },
    { collected: [], current: undefined }
  )
  return finalState.collected
}

/**
 * Escape user-supplied text for safe inclusion in HTML attribute values and
 * text nodes. Mirrors markdown-it's own `escapeHtml` (we cannot import it
 * directly without leaking implementation details into the domain layer).
 *
 * Used for the unknown-/no-language graceful-degrade fallback in the `fence`
 * renderer, where the raw source is the only output and must be HTML-safe.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * Filter headings to those at or above the given max depth.
 *
 * The user story [internal ref] specifies that `toc.maxDepth`
 * controls the deepest heading level included. Defaults are configured by
 * the caller (the page-mode renderer).
 */
export const filterTocHeadings = (
  headings: readonly MarkdownHeading[],
  maxDepth: number
): readonly MarkdownHeading[] => headings.filter((heading) => heading.level <= maxDepth)
