/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import DOMPurify from 'dompurify'
import { type ReactElement } from 'react'
import { buildAccessibilityRole, buildScrollAttributes } from './html-element-helpers'

/**
 * Common props for all rendered elements
 */
export interface ElementProps {
  readonly [key: string]: unknown
  readonly className?: string
  readonly 'data-block'?: string
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

/**
 * Configuration for renderHTMLElement
 */
type HTMLElementConfig = {
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
 * Otherwise renders as div to ensure proper ARIA generic role.
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

/**
 * Renders paragraph element
 */
export function renderParagraph(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <p {...props}>{content || children}</p>
}

/**
 * Renders code element (inline code)
 */
export function renderCode(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <code {...props}>{content || children}</code>
}

/**
 * Renders pre element (preformatted text block)
 */
export function renderPre(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <pre {...props}>{content || children}</pre>
}

/**
 * Renders image element
 */
export function renderImage(props: ElementProps): ReactElement {
  return (
    <img
      {...props}
      alt={(props.alt as string | undefined) || ''}
    />
  )
}

/**
 * Renders avatar image with circular border-radius
 * Includes default dimensions to ensure visibility even when image fails to load
 */
export function renderAvatar(props: ElementProps): ReactElement {
  const style = {
    ...((props.style as Record<string, unknown> | undefined) || {}),
    minWidth: '48px',
    minHeight: '48px',
    width: '48px',
    height: '48px',
  }

  return (
    <img
      {...props}
      style={style}
      alt={(props.alt as string | undefined) || ''}
      className={[props.className, 'rounded-full'].filter(Boolean).join(' ')}
    />
  )
}

/**
 * Renders thumbnail image with moderate border-radius
 * Applies md radius (0.375rem) for soft corners while preserving aspect ratio
 */
export function renderThumbnail(props: ElementProps): ReactElement {
  return (
    <img
      {...props}
      alt={(props.alt as string | undefined) || ''}
      className={[props.className, 'rounded-md'].filter(Boolean).join(' ')}
    />
  )
}

/**
 * Renders hero image with top-only border-radius
 * Applies lg radius to top corners only for integration with card layout
 */
export function renderHeroImage(props: ElementProps): ReactElement {
  return (
    <img
      {...props}
      alt={(props.alt as string | undefined) || ''}
      className={[props.className, 'rounded-t-lg'].filter(Boolean).join(' ')}
    />
  )
}

/**
 * Renders video element
 */
export function renderVideo(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <video {...props}>{children}</video>
}

/**
 * Renders audio element
 */
export function renderAudio(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <audio {...props}>{children}</audio>
}

/**
 * Renders iframe element
 */
export function renderIframe(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <iframe {...props}>{children}</iframe>
}

/**
 * Build data attributes for click interactions
 */
function buildClickDataAttributes(clickInteraction: {
  animation?: string
  navigate?: string
  openUrl?: string
  openInNewTab?: boolean
  scrollTo?: string
  toggleElement?: string
  submitForm?: string
}): Record<string, string> {
  return {
    ...(clickInteraction.animation && { 'data-click-animation': clickInteraction.animation }),
    ...(clickInteraction.navigate && { 'data-click-navigate': clickInteraction.navigate }),
    ...(clickInteraction.openUrl && { 'data-click-open-url': clickInteraction.openUrl }),
    ...(clickInteraction.openInNewTab !== undefined && {
      'data-click-open-in-new-tab': String(clickInteraction.openInNewTab),
    }),
    ...(clickInteraction.scrollTo && { 'data-click-scroll-to': clickInteraction.scrollTo }),
    ...(clickInteraction.toggleElement && {
      'data-click-toggle-element': clickInteraction.toggleElement,
    }),
    ...(clickInteraction.submitForm && {
      'data-click-submit-form': clickInteraction.submitForm,
    }),
  }
}

/**
 * Renders button element with click interactions
 */
export function renderButton(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[],
  interactions?: unknown
): ReactElement {
  const interactionsTyped = interactions as
    | {
        click?: {
          animation?: string
          navigate?: string
          openUrl?: string
          openInNewTab?: boolean
          scrollTo?: string
          toggleElement?: string
          submitForm?: string
        }
      }
    | undefined
  const clickInteraction = interactionsTyped?.click

  // Store interaction data in data attributes for client-side JavaScript handler
  const buttonProps = clickInteraction
    ? { ...props, ...buildClickDataAttributes(clickInteraction) }
    : props

  return <button {...buttonProps}>{content || children}</button>
}

/**
 * Renders link (anchor) element
 */
export function renderLink(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <a {...props}>{content || children}</a>
}

/**
 * Renders form element
 */
export function renderForm(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <form {...props}>{children}</form>
}

/**
 * Renders input element
 */
export function renderInput(props: ElementProps): ReactElement {
  return <input {...props} />
}

/**
 * Renders badge (styled span) element
 */
export function renderBadge(props: ElementProps, content: string | undefined): ReactElement {
  return <span {...props}>{content}</span>
}

/**
 * Renders icon as SVG element
 * Uses 'name' prop to generate data-testid="icon-{name}"
 * Uses 'color' prop to add data-color attribute
 * Adds minimum dimensions to ensure visibility
 */
export function renderIcon(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  const iconName = props.name as string | undefined
  const iconColor = props.color as string | undefined
  const existingStyle = (props.style as Record<string, unknown> | undefined) || {}
  const iconProps = {
    ...props,
    ...(iconName && { 'data-testid': `icon-${iconName}` }),
    ...(iconColor && { 'data-color': iconColor }),
    style: {
      display: 'inline-block',
      minWidth: '1rem',
      minHeight: '1rem',
      ...existingStyle,
    },
  }
  return <svg {...iconProps}>{children}</svg>
}

/**
 * Renders custom HTML with DOMPurify sanitization
 *
 * SECURITY: This function sanitizes HTML to prevent XSS attacks.
 * DOMPurify removes malicious scripts, event handlers, and dangerous attributes.
 * Critical for user-generated content or external HTML sources.
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML (after sanitization)
 * - Content: User-provided or external HTML (props.html)
 * - Source: Potentially untrusted - user input or external sources
 * - Risk: None (after sanitization) - XSS prevented by DOMPurify
 * - Validation: DOMPurify removes all malicious content
 * - Purpose: Render custom HTML blocks safely
 * - XSS Protection: DOMPurify sanitization removes scripts, event handlers, dangerous tags
 * - Best Practice: This is the ONLY way to render user-generated HTML safely
 */
export function renderCustomHTML(props: ElementProps): ReactElement {
  const sanitizedHTML = DOMPurify.sanitize((props.html as string | undefined) || '')
  return (
    <div
      {...props}
      // Safe to use dangerouslySetInnerHTML after DOMPurify sanitization
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}

/**
 * Specialized renderers (alert, list, language-switcher) are in specialized-renderers.tsx
 * Re-export them here for backward compatibility
 */
export {
  renderLanguageSwitcher,
  renderAlert,
  renderList,
  renderUnorderedList,
  renderListItem,
} from './specialized-renderers'
