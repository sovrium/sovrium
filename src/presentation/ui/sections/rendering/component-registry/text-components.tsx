/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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

export const textComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  code: ({ elementProps, content, renderedChildren }) => {
    const language = elementProps['language'] as string | undefined
    const lineNumbers = elementProps['lineNumbers'] as boolean | undefined
    const {
      'data-testid': dataTestId,
      language: _l,
      'data-language': _dl,
      lineNumbers: _ln,
      'data-line-numbers': _dln,
      className,
      ...rest
    } = elementProps as Record<string, unknown>
    const cn = className as string | undefined
    const preClass = cn ? `${cn} font-mono` : 'font-mono'
    const codeClass = language ? `language-${language}` : undefined
    return (
      <div className="relative">
        <pre
          {...rest}
          className={preClass}
          data-testid={dataTestId as string | undefined}
          data-line-numbers={lineNumbers ? 'true' : undefined}
        >
          <code
            className={codeClass}
            data-language={language}
          >
            {content ?? renderedChildren}
          </code>
        </pre>
        <button
          type="button"
          aria-label="Copy code to clipboard"
          data-copy-code="true"
          className="bg-background absolute top-2 right-2 rounded border px-2 py-1 text-xs"
        >
          Copy
        </button>
      </div>
    )
  },

  text: ({ elementProps, content, renderedChildren, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const element = c['element'] as string | undefined
    const headingLevel = element ? HEADING_LEVELS[element] : undefined

    if (headingLevel) {
      return Renderers.renderHeading(
        headingLevel as 1 | 2 | 3 | 4 | 5 | 6,
        elementProps,
        content,
        renderedChildren
      )
    }
    if (element === 'pre') {
      return Renderers.renderPre(elementProps, content, renderedChildren)
    }
    if (element === 'code') {
      return Renderers.renderCode(elementProps, content, renderedChildren)
    }
    if (element === 'p') {
      return Renderers.renderParagraph(elementProps, content, renderedChildren)
    }
    if (element === 'blockquote') {
      return Renderers.renderBlockquote(elementProps, content, renderedChildren)
    }
    if (element === 'label') {
      const required = c['required'] === true
      const labelText = typeof content === 'string' && content.length > 0 ? content : undefined
      const labelContent = required && labelText ? `${labelText} *` : labelText
      return <label {...elementProps}>{labelContent ?? renderedChildren}</label>
    }

    return Renderers.renderTextElement(elementProps, content, renderedChildren)
  },
}
