/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * PRE-render Shiki highlight pass for the standalone `code` COMPONENT
 * ([internal ref]..033, [internal ref]).
 *
 * ## Why a pre-pass and not a post-render splice
 *
 * The original design highlighted code AFTER `renderToString`, by regex-matching
 * a `data-code-block="<base64>"` placeholder in the finished HTML
 * (`component-code-highlighter.ts`). That works only while the placeholder stays
 * a real DOM attribute in the output — and it does NOT for a `code` component
 * nested inside a `tabs` panel: `island-form-components.tsx` serialises each
 * tab-panel's rendered children through `renderToStaticMarkup` into a
 * `data-island-props` JSON attribute, so the placeholder arrives JSON- AND
 * HTML-escaped and the splice regex can never match. Code inside a tab therefore
 * shipped unhighlighted (this also affected the admin API-docs surface).
 *
 * Moving the highlight to a pre-render resolver removes the whole class of
 * problem: by the time any renderer runs, the highlighted markup is already
 * attached to the component node, so it survives every downstream serialisation
 * the render pipeline performs.
 *
 * The precedent copied here is `resolvePageToc` (`toc-resolver.ts`): walk the
 * resolved component tree, compute something the sync renderer cannot, and plumb
 * it back as a render-time-only field (`codeHighlight`) that the renderer reads
 * off `config.component.*`. The schema author never writes it.
 *
 * ## Failure is a fall-through, not an error
 *
 * When the extraction regex does not match Shiki's output shape, no
 * `codeHighlight` is attached and the renderer emits today's placeholder `<pre>`
 * instead — which the (retained) post-render splice still handles. The change is
 * therefore strictly additive: `component-code-highlighter.ts` stays wired in
 * `render-page.tsx` and simply matches nothing on the happy path.
 *
 * Every highlighted fragment passes through the single canonical
 * `sanitizeRichTextHTML` (security rule S2) before extraction, so the token
 * contract (`class` kept on pre/code/span, `style` dropped) is unchanged.
 */

import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { highlightCodeToHtml } from '@/infrastructure/markdown/shiki-highlighter'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Render-time-only payload attached to a highlightable `code` component.
 *
 * `preClass` is Shiki's own `<pre>` class list (`shiki <themeName>`), which the
 * renderer must re-emit verbatim so the theme-name selector contract
 * (`[class*="nord"]`, [internal ref]) and the code-block chrome CSS both
 * still resolve. `innerHtml` is the `<code>…</code>` subtree, injected by the
 * renderer into a React-owned `<pre>` so the author's `data-testid` / `id` stay
 * on the `<pre>` element itself.
 */
export interface CodeHighlight {
  readonly preClass: string
  readonly innerHtml: string
}

/** A tree node as seen by the walker: a component, a `$ref`, or a plain string. */
type TreeNode = unknown

/** The `{ lang, code }` pair a single highlightable `code` node contributes. */
interface HighlightRequest {
  readonly lang: string
  readonly code: string
}

/**
 * Match Shiki's single-`<pre>` fragment and split it into the opening tag's
 * attributes and the `<code>…</code>` body. Anchored at both ends (the fragment
 * is exactly one `<pre>` block) and greedy on the body so a nested `</pre>` —
 * impossible in escaped code, but cheap to be safe about — cannot truncate it.
 */
const PRE_FRAGMENT_RE = /^\s*<pre\b([^>]*)>([\s\S]*)<\/pre>\s*$/
const CLASS_ATTR_RE = /\bclass="([^"]*)"/

/**
 * Read `children` off a node, or `undefined` when absent / not an array.
 * Mirrors `toc-resolver.getChildren` — the two walkers deliberately share the
 * same tolerant shape-reading style rather than a discriminated union, because
 * the tree also holds `$ref` placeholders and plain strings.
 */
function getChildren(node: TreeNode): readonly TreeNode[] | undefined {
  const { children } = node as { readonly children?: unknown }
  return Array.isArray(children) ? (children as readonly TreeNode[]) : undefined
}

/** True for a walkable component node (not a string, not a `$ref` placeholder). */
function isWalkable(node: TreeNode): boolean {
  if (typeof node !== 'object' || node === null) return false
  return !('component' in node) && !('$ref' in node)
}

/**
 * The `{ lang, code }` a node contributes, or `undefined` when it is not a
 * highlightable `code` component. Only a `code` component carrying BOTH a
 * `props.language` and literal string `content` is highlightable — a
 * children-based or language-less block stays plain.
 */
function highlightRequestFor(node: TreeNode): HighlightRequest | undefined {
  const component = node as {
    readonly type?: unknown
    readonly props?: Record<string, unknown>
    readonly content?: unknown
  }
  if (component.type !== 'code') return undefined
  const lang = component.props?.['language']
  const code = component.content
  if (typeof lang !== 'string' || lang.length === 0) return undefined
  if (typeof code !== 'string') return undefined
  return { lang, code }
}

/**
 * Cheap precheck (mirrors `toc-resolver.hasToc`): does the tree hold any
 * highlightable `code` node? Lets the common case — a page with no code
 * component — skip the collect/highlight/attach round trip entirely.
 */
function hasHighlightableCode(nodes: readonly TreeNode[] | undefined): boolean {
  if (!nodes) return false
  return nodes.some((node) => {
    if (!isWalkable(node)) return false
    if (highlightRequestFor(node) !== undefined) return true
    return hasHighlightableCode(getChildren(node))
  })
}

/**
 * Collect every highlightable node, flattened out of the tree.
 *
 * The nodes themselves are collected (not just their `{ lang, code }`), so the
 * attach pass can pair each result with its node BY REFERENCE. An index-based
 * pairing would silently mis-assign highlights the moment the two walks
 * disagreed on traversal order — a failure mode that would show up as one code
 * block wearing another's colours.
 */
function collectCodeNodes(nodes: readonly TreeNode[] | undefined): readonly TreeNode[] {
  if (!nodes) return []
  return nodes.flatMap((node) => {
    if (!isWalkable(node)) return []
    if (highlightRequestFor(node) !== undefined) return [node]
    return collectCodeNodes(getChildren(node))
  })
}

/** One resolved node → its highlighted fragment (`undefined` on extraction failure). */
type ResolvedHighlight = readonly [TreeNode, CodeHighlight | undefined]

/**
 * Attach the pre-computed `codeHighlight` to every node that got one. A node
 * whose fragment failed extraction gets nothing and falls through to the
 * renderer's placeholder path.
 *
 * The lookup is a linear scan rather than a `Map`, because a page holds a
 * handful of code blocks at most and an association list keeps the whole pass
 * free of mutation.
 */
function attachHighlights(
  nodes: readonly TreeNode[] | undefined,
  resolved: readonly ResolvedHighlight[]
): readonly TreeNode[] | undefined {
  if (!nodes) return nodes
  return nodes.map((node) => {
    if (!isWalkable(node)) return node
    const highlight = resolved.find(([candidate]) => candidate === node)?.[1]
    if (highlight !== undefined) return { ...(node as object), codeHighlight: highlight }
    const children = getChildren(node)
    if (children && children.length > 0) {
      return { ...(node as object), children: attachHighlights(children, resolved) }
    }
    return node
  })
}

/**
 * Split a sanitised Shiki fragment into `{ preClass, innerHtml }`. Returns
 * `undefined` when the fragment is not the expected single-`<pre>` shape, which
 * makes the caller fall through to the legacy post-render splice.
 */
function extractHighlight(fragment: string): CodeHighlight | undefined {
  const match = PRE_FRAGMENT_RE.exec(fragment)
  if (match === null) return undefined
  const attrs = match[1] ?? ''
  const innerHtml = match[2]
  if (innerHtml === undefined) return undefined
  return { preClass: CLASS_ATTR_RE.exec(attrs)?.[1] ?? '', innerHtml }
}

/**
 * Highlight one request through the SAME engine + transformer the markdown
 * fence path uses, then sanitise and split it. `getShikiForTheme` is cached per
 * theme, so highlighting N blocks on a page costs a single engine build.
 */
async function resolveOne(
  node: TreeNode,
  theme: string | undefined
): Promise<readonly [TreeNode, CodeHighlight | undefined]> {
  const request = highlightRequestFor(node)
  if (request === undefined) return [node, undefined]
  const highlighted = await highlightCodeToHtml(request.lang, request.code, theme)
  return [node, extractHighlight(sanitizeRichTextHTML(highlighted))]
}

/**
 * Core pass: walk a component array, highlight every `code` node it holds, and
 * return the array with `codeHighlight` attached. Returns the input unchanged
 * (same reference) when the tree holds no highlightable code.
 */
async function resolveCodeHighlights(
  nodes: readonly TreeNode[] | undefined,
  theme: string | undefined
): Promise<readonly TreeNode[] | undefined> {
  if (!hasHighlightableCode(nodes)) return nodes
  const resolved = await Promise.all(collectCodeNodes(nodes).map((node) => resolveOne(node, theme)))
  return attachHighlights(nodes, resolved)
}

/**
 * Page-level pass — attaches `codeHighlight` to every `code` component on the
 * page (including ones nested inside containers, tab panels, or flex layouts).
 *
 * Runs in the async page-render phase where `app.theme.codeBlock.theme` is
 * available, BEFORE `renderToString`, so a `code` component inside a `tabs`
 * panel carries its highlighted markup through the island's
 * `renderToStaticMarkup` serialisation intact.
 */
export async function resolvePageCodeHighlights(
  components: Page['components'],
  theme: string | undefined
): Promise<Page['components']> {
  const resolved = await resolveCodeHighlights(components, theme)
  return resolved as Page['components']
}

/**
 * Template-level pass — the same walk over `app.components`.
 *
 * Required because a page's real content is frequently reached only through a
 * `{ component: 'name' }` reference: the component tree the page declares holds
 * a placeholder, and the actual `code` node lives in the referenced template.
 * Walking only `page.components` would leave every referenced code block
 * unhighlighted.
 */
export async function resolveComponentsCodeHighlights(
  components: App['components'],
  theme: string | undefined
): Promise<App['components']> {
  if (components === undefined) return components
  const resolved = await resolveCodeHighlights(components as readonly TreeNode[], theme)
  return resolved as App['components']
}

/**
 * Read the render-time-only `codeHighlight` field back off a component. Kept
 * here (next to the writer) so the renderer never has to know the field name or
 * repeat the cast.
 */
export function readCodeHighlight(component: Component | undefined): CodeHighlight | undefined {
  const highlight = (component as { readonly codeHighlight?: unknown } | undefined)?.codeHighlight
  if (typeof highlight !== 'object' || highlight === null) return undefined
  const { preClass, innerHtml } = highlight as Partial<CodeHighlight>
  if (typeof preClass !== 'string' || typeof innerHtml !== 'string') return undefined
  return { preClass, innerHtml }
}
