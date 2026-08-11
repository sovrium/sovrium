/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderTextComponentMarkdown } from '@/presentation/rendering/text-component-markdown'
import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

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

/** The `$session.<field>` interpolation token (mirrors the client resolver). */
const SESSION_TOKEN_PATTERN = /\$session\.\w+/g

/**
 * Resolve a `text` component's CLIENT-SIDE session binding. A `session: <field>` field, or a `$session.<field>` token in the
 * resolved `content`, is a template the global client enhancer fills from
 * `GET /api/auth/get-session`. We emit a `data-session-template` marker for the
 * enhancer and render an anon-safe SSR placeholder (empty for a bare `session`
 * field; the `content` with every `$session.<field>` token stripped to '' for the
 * token form) so an anonymous caller never sees an identity and a statically
 * cached page never leaks one across users. Returns the original props/content
 * unchanged when no session binding is present.
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
    content:
      sessionField !== undefined ? undefined : template.replaceAll(SESSION_TOKEN_PATTERN, ''),
  }
}

export const textComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
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
    // markdown-page article wrapper convention (see MarkdownArticle.tsx) and
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
