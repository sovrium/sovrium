/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveSessionTemplate } from '@/presentation/design/session-template'
import { renderTextComponentMarkdown } from '@/presentation/render/markdown/text-component-markdown'
import * as Renderers from '../elements'
import { kbdComponent } from './kbd-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

/**
 * Text and heading components (h1-h6, text, paragraph, code, etc.)
 *
 * These components render text content and typography elements.
 */
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

export const textComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  // `kbd` — a key or a chord, as keycaps. It sits with the text family because
  // that is what it is: an inline element inside a sentence. In its own module
  // for the reason the standalone `code` block is in one — this file's `text:`
  // renderer already carries two complexity disables and has no room for a
  // second growing dispatch.
  kbd: kbdComponent,

  // NOTE: the standalone `code` block renderer used to live here. It moved to
  // `code-block-component.tsx` when the block gained frame chrome (filename
  // header, terminal marker, command output) and a working copy button — this
  // file was already carrying complexity disables on its `text:` renderer and
  // had no room for a second growing dispatch.

  // eslint-disable-next-line complexity, max-statements -- [internal ref] Lane C debt + P-05 markdown branch: text renderer dispatches across 14 element variants (h1..h6, p, span, label, code, etc.) plus the markdown branch. Measured 2026-07-30 AFTER the standalone `code` block moved to `code-block-component.tsx`: complexity 17 (max 10), 23 statements (max 20) — that extraction did NOT bring either under its cap, so both disables are still load-bearing. Dropping them needs the element chain replaced by a per-variant dispatch table (the four same-signature branches — pre/code/p/blockquote — plus the `label` branch lifted into its own helper); another extraction of one variant will not do it.
  text: ({ elementProps, content, renderedChildren, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const element = c['element'] as string | undefined
    const headingLevel = element ? HEADING_LEVELS[element] : undefined

    // Markdown rendering branch (P-05): when `props.format === 'markdown'` and
    // the resolved `content` is a string (page-variable/`$record.X` substitution
    // has already run upstream in `applyVariableSubstitution`), parse the source
    // through markdown-it (which is configured with `html: false`, so any author
    // raw HTML is dropped at parse time) and sanitise the resulting HTML through
    // the single canonical `sanitizeRichTextHTML` (security rule S2 — never add
    // a second sanitiser). Defense-in-depth: even though markdown-it drops raw
    // HTML, we still sanitise — covers any future parser bug or plugin that
    // re-enables HTML.
    //
    // Wrapper is `<article data-component="markdown">`: matches the existing
    // markdown-page article wrapper convention (see markdown-article.tsx) and
    // satisfies the spec selector `article, [data-component="markdown"]`. The
    // wrapper carries the schema-level `elementProps` (className/id/data-testid)
    // so author attributes survive the markdown branch.
    if (rawProps?.['format'] === 'markdown' && typeof content === 'string') {
      const safeHtml = renderTextComponentMarkdown(content)
      return (
        <article
          {...elementProps}
          data-component="markdown"
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR one-shot; HTML is pre-rendered + canonically sanitised
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      )
    }

    // CLIENT-SIDE session binding: a `session`
    // field or a `$session.<field>` content token emits a `data-session-template`
    // marker + an anon-safe SSR placeholder; the global enhancer fills it from the
    // caller's own session. A no-op (props/content unchanged) when absent.
    const { props: sProps, content: sContent } = resolveSessionBinding(c, elementProps, content)

    if (headingLevel) {
      return Renderers.renderHeading(
        headingLevel as 1 | 2 | 3 | 4 | 5 | 6,
        sProps,
        sContent,
        renderedChildren
      )
    }
    if (element === 'pre') {
      return Renderers.renderPre(sProps, sContent, renderedChildren)
    }
    if (element === 'code') {
      return Renderers.renderCode(sProps, sContent, renderedChildren)
    }
    if (element === 'p') {
      return Renderers.renderParagraph(sProps, sContent, renderedChildren)
    }
    if (element === 'blockquote') {
      return Renderers.renderBlockquote(sProps, sContent, renderedChildren)
    }
    if (element === 'label') {
      // `required` is a top-level schema field (sibling of `props`). When
      // set, we append ` *` directly to the label's text content so the
      // smallest element containing "Full name" is the `<label>` itself
      // (Playwright's `getByText('Full name')` substring-matches "Full name *"
      // and returns the label). The literal label text node carries the
      // asterisk so `.toContainText('*')` resolves on the same element.
      const required = c['required'] === true
      const labelText = typeof sContent === 'string' && sContent.length > 0 ? sContent : undefined
      const labelContent = required && labelText ? `${labelText} *` : labelText
      return <label {...sProps}>{labelContent ?? renderedChildren}</label>
    }

    return Renderers.renderTextElement(sProps, sContent, renderedChildren)
  },
}
