/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildAccessibilityRole, buildScrollAttributes } from '../html-element-helpers'

/**
 * Common props for all rendered elements
 */
export interface ElementProps {
  readonly [key: string]: unknown
  readonly className?: string
  readonly 'data-block'?: string
}

/**
 * Configuration for renderHTMLElement
 */
export type HTMLElementConfig = {
  readonly type:
    | 'div'
    | 'span'
    | 'section'
    | 'header'
    | 'footer'
    | 'main'
    | 'article'
    | 'aside'
    | 'nav'
  readonly props: ElementProps
  readonly content: string | undefined
  readonly children: readonly React.ReactNode[]
  readonly interactions?: unknown
}

/**
 * Renders HTML structural elements (div, span, section, and HTML5 semantic elements)
 *
 * If content starts with '<', it's treated as HTML and rendered via dangerouslySetInnerHTML.
 * Otherwise, content is rendered as plain text.
 *
 * SECURITY NOTE - Trusted Schema Content:
 * HTML content is rendered without sanitization since it comes from trusted
 * schema configuration. For user-generated content, use renderCustomHTML instead.
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: Schema-defined HTML from page configuration
 * - Source: Validated Page schema (section.content property)
 * - Risk: Low - content is from server configuration, not user input
 * - Validation: Content validated at build/runtime via schema
 * - Purpose: Render rich HTML content in structural elements
 * - XSS Protection: Use renderCustomHTML with DOMPurify for user-generated content
 * - Condition: Only used when content starts with '<' character
 *
 * For section elements, automatically adds role="region" for accessibility best practices,
 * ensuring sections are properly identified in the accessibility tree.
 *
 * Supports scroll interactions via data attributes for IntersectionObserver.
 */
export function renderHTMLElement(config: HTMLElementConfig): ReactElement {
  const { type, props, content, children, interactions } = config
  const Element = type

  // Build element props immutably
  const accessibilityRole = buildAccessibilityRole(type, children.length > 0, !!content, props.role)
  const scrollAttributes = buildScrollAttributes(interactions)
  const elementProps = { ...props, ...accessibilityRole, ...scrollAttributes }

  // If content looks like HTML (starts with '<'), render as HTML
  // This is safe for schema-defined content but should NOT be used for user input
  if (content?.trim().startsWith('<')) {
    return (
      <Element
        {...elementProps}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  return <Element {...elementProps}>{content || children}</Element>
}

/**
 * Renders heading elements (h1-h6)
 */
export function renderHeading(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  return <HeadingTag {...props}>{content || children}</HeadingTag>
}

/**
 * Renders text element with dynamic level
 *
 * The text element supports a 'level' prop to determine the HTML tag.
 * If level is h1-h6, renders as heading.
 * If level is p, renders as paragraph.
 * If level is label, renders as label.
 * Otherwise renders as span to ensure proper ARIA generic role.
 */
export function renderTextElement(props: ElementProps, content: string | undefined): ReactElement {
  const { level } = props

  if (level === 'h1') return <h1 {...props}>{content}</h1>
  if (level === 'h2') return <h2 {...props}>{content}</h2>
  if (level === 'h3') return <h3 {...props}>{content}</h3>
  if (level === 'h4') return <h4 {...props}>{content}</h4>
  if (level === 'h5') return <h5 {...props}>{content}</h5>
  if (level === 'h6') return <h6 {...props}>{content}</h6>
  if (level === 'p') return <p {...props}>{content}</p>
  if (level === 'label') return <label {...props}>{content}</label>

  // Default to span for inline text to ensure proper ARIA generic role
  // span elements with text content maintain generic role in ARIA tree
  return <span {...props}>{content}</span>
}
