/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderTextComponentMarkdown } from '@/presentation/rendering/text-component-markdown'
import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

const SESSION_TOKEN_PATTERN = /\$session\.\w+/g

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

export const textComponents: Partial<Record<Component['type'], ComponentRenderer>> = {

  text: ({ elementProps, content, renderedChildren, component, rawProps }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const element = c['element'] as string | undefined
    const headingLevel = element ? HEADING_LEVELS[element] : undefined

    if (rawProps?.['format'] === 'markdown' && typeof content === 'string') {
      const safeHtml = renderTextComponentMarkdown(content)
      return (
        <article
          {...elementProps}
          data-component="markdown"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      )
    }

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
      const required = c['required'] === true
      const labelText = typeof sContent === 'string' && sContent.length > 0 ? sContent : undefined
      const labelContent = required && labelText ? `${labelText} *` : labelText
      return <label {...sProps}>{labelContent ?? renderedChildren}</label>
    }

    return Renderers.renderTextElement(sProps, sContent, renderedChildren)
  },
}
