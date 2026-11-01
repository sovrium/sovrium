/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveSessionTemplate } from '@/presentation/design/session-template'
import { applyProsePartClasses } from '@/presentation/render/markdown/prose-part-classes'
import { renderTextComponentMarkdown } from '@/presentation/render/markdown/text-component-markdown'
import * as Renderers from '../elements'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { kbdComponent } from './kbd-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

/**
 * Text and heading components (h1-h6, text, paragraph, code, etc.)
 *
 * These components render text content and typography elements.
 */
/**
 * The elements a `text` draws as themselves with nothing but its props and
 * its content or children, keyed by element name.
 */
const PLAIN_TEXT_RENDERERS: ReadonlyMap<string, typeof Renderers.renderParagraph> = new Map([
  ['pre', Renderers.renderPre],
  ['code', Renderers.renderCode],
  ['p', Renderers.renderParagraph],
  ['blockquote', Renderers.renderBlockquote],
  ['kbd', Renderers.renderKbd],
])

/**
 * Heading element names mapped to their heading level numbers.
 */
const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

/**
 * Resolve a `text` component's CLIENT-SIDE session binding. A `session: <field>` field, or a `$session.<field>` token in the
 * resolved `content`, is a template the global client enhancer fills from
 * `GET /api/auth/get-session`. We emit a `data-session-template` marker for the
 * enhancer and render an anon-safe SSR placeholder so an anonymous caller never
 * sees an identity and a statically cached page never leaks one across users.
 *
 * The placeholder is not a second implementation: the server IS the anonymous
 * case, so it runs the SHARED grammar with no session
 * (`resolveSessionTemplate(template, undefined)`). That is what drops a
 * `[, $session.name]` optional segment WHOLE — comma and all — instead of
 * serving the stranded `[, ]` a token-only strip leaves behind, and it is why
 * the two sides cannot disagree about where the brackets went.
 *
 * Returns the original props/content unchanged when no session binding is
 * present.
 */
function resolveSessionBinding(
  componentRaw: Record<string, unknown>,
  elementProps: Record<string, unknown>,
  content: string | undefined
): { readonly props: Record<string, unknown>; readonly content: string | undefined } {
  const sessionField =
    typeof componentRaw['session'] === 'string' ? componentRaw['session'] : undefined
  const template =
    sessionField !== undefined
      ? `$session.${sessionField}`
      : typeof content === 'string' && content.includes('$session.')
        ? content
        : undefined
  if (template === undefined) return { props: elementProps, content }
  return {
    props: { ...elementProps, 'data-session-template': template },
    content: sessionField !== undefined ? undefined : resolveSessionTemplate(template, undefined),
  }
}

/**
 * The same binding for a component whose `content` is its only text (a
 * `badge`): a `$session.<field>` token — written in the page, or arriving in
 * the translation a `$t:` key names — makes the content a template the client
 * enhancer fills, with the anonymous reading served in its place.
 */
export function bindSessionContent(
  elementProps: Record<string, unknown>,
  content: string | undefined
): { readonly props: Record<string, unknown>; readonly content: string | undefined } {
  return resolveSessionBinding({}, elementProps, content)
}

/**
 * A text whose content resolved to nothing — a `$app.version` the app does not
 * declare, a `$record.` field left empty — and that carries no children draws
 * no node at all: an empty `<p>` or `<span>` is still announced by a screen
 * reader and still takes its padding. Only the empty string counts: a text
 * authored as a single space is a deliberate separator between two inline
 * siblings, and dropping it glues their words together.
 *
 * Unless something can still fill it: an `id` (a status line an action writes
 * into, a script's target), a live region (`role`, `aria-live`), or a session
 * binding, whose empty server reading is a placeholder the client fills.
 */
const resolvedToNothing = (
  content: string | undefined,
  renderedChildren: readonly unknown[],
  component: Record<string, unknown>,
  props: Record<string, unknown>
): boolean =>
  typeof content === 'string' &&
  content === '' &&
  renderedChildren.length === 0 &&
  component['session'] === undefined &&
  props['id'] === undefined &&
  props['role'] === undefined &&
  props['aria-live'] === undefined

/**
 * Drop what the language script rewrites an element's words from. It writes text
 * only, so on rendered Markdown it would replace the server's markup with its
 * source; that markup changes language with the page the server composes.
 */
function omitLanguageScriptPayload(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key]) => !['data-translation-key', 'data-translations', 'data-i18n-content'].includes(key)
    )
  )
}

export const textComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  // `kbd` — a key or a chord, as keycaps. It sits with the text family because
  // that is what it is: an inline element inside a sentence. In its own module
  // for the reason the standalone `code` block is in one: the `text:` renderer
  // is a dispatch of its own, and a second growing one belongs elsewhere.
  kbd: kbdComponent,

  // NOTE: the standalone `code` block renderer lives in
  // `code-block-component.tsx`, not here: it carries frame chrome (filename
  // header, terminal marker, command output) and a copy button, a second
  // growing dispatch beside the `text:` renderer's own.

  text: (context) =>
    resolvedToNothing(
      context.content,
      context.renderedChildren,
      (context.component ?? {}) as Record<string, unknown>,
      context.elementProps
    )
      ? null
      : renderText(context),
}

/**
 * Markdown rendering branch (P-05): when `props.format === 'markdown'` and
 * the resolved `content` is a string (page-variable/`$record.X` substitution
 * has already run upstream in `applyVariableSubstitution`), parse the source
 * through markdown-it (whose `drop_raw_html` core rule drops any author raw
 * HTML at parse time) and sanitise the resulting HTML through
 * the single canonical `sanitizeRichTextHTML` (security rule S2 — never add
 * a second sanitiser). Defense-in-depth: even though markdown-it drops raw
 * HTML, we still sanitise — covers any future parser bug or plugin that
 * re-enables HTML.
 *
 * Wrapper is `<article data-component="markdown">`: matches the existing
 * markdown-page article wrapper convention (see markdown-article.tsx) and
 * satisfies the spec selector `article, [data-component="markdown"]`. The
 * wrapper carries the schema-level `elementProps` (className/id/data-testid)
 * so author attributes survive the markdown branch.
 */
function renderMarkdownText(
  elementProps: Record<string, unknown>,
  content: string,
  designStyles: Parameters<ComponentRenderer>[0]['designStyles']
): ReturnType<ComponentRenderer> {
  const safeHtml = applyProsePartClasses(renderTextComponentMarkdown(content), designStyles?.parts)
  return (
    <article
      {...omitLanguageScriptPayload(omitInternalMarkers(elementProps))}
      data-component="markdown"
      // eslint-disable-next-line sovrium/require-sanitized-html -- sanitizeRichTextHTML output; applyProsePartClasses only adds escaped class and data-part attributes
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

/**
 * A `label` text. `required` is a top-level schema field (sibling of `props`).
 * When set, we append ` *` directly to the label's text content so the
 * smallest element containing "Full name" is the `<label>` itself
 * (Playwright's `getByText('Full name')` substring-matches "Full name *"
 * and returns the label). The literal label text node carries the
 * asterisk so `.toContainText('*')` resolves on the same element.
 */
function renderLabelText(
  props: Record<string, unknown>,
  content: string | undefined,
  children: readonly React.ReactNode[],
  required: boolean
): ReturnType<ComponentRenderer> {
  const labelText = typeof content === 'string' && content.length > 0 ? content : undefined
  const labelContent = required && labelText ? `${labelText} *` : labelText
  return <label {...props}>{labelContent ?? children}</label>
}

/** A `text` component, drawn as the element it names (h1..h6, p, span, label, code, …) or as markdown. */
function renderText({
  elementProps,
  content,
  renderedChildren,
  component,
  rawProps,
  designStyles,
}: Parameters<ComponentRenderer>[0]): ReturnType<ComponentRenderer> {
  if (rawProps?.['format'] === 'markdown' && typeof content === 'string') {
    return renderMarkdownText(elementProps, content, designStyles)
  }
  const c = (component ?? {}) as Record<string, unknown>
  const element = typeof c['element'] === 'string' ? c['element'] : ''

  // CLIENT-SIDE session binding: a `session`
  // field or a `$session.<field>` content token emits a `data-session-template`
  // marker + an anon-safe SSR placeholder; the global enhancer fills it from the
  // caller's own session. A no-op (props/content unchanged) when absent.
  const { props: sProps, content: sContent } = resolveSessionBinding(c, elementProps, content)

  const headingLevel = HEADING_LEVELS[element]
  if (headingLevel !== undefined) {
    return Renderers.renderHeading(
      headingLevel as 1 | 2 | 3 | 4 | 5 | 6,
      sProps,
      sContent,
      renderedChildren
    )
  }
  const plainRenderer = PLAIN_TEXT_RENDERERS.get(element)
  if (plainRenderer !== undefined) return plainRenderer(sProps, sContent, renderedChildren)
  if (element === 'label') {
    return renderLabelText(sProps, sContent, renderedChildren, c['required'] === true)
  }
  return Renderers.renderTextElement(sProps, sContent, renderedChildren)
}
