/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { type Design } from '@/domain/models/app/design'
import { type Languages } from '@/domain/models/app/languages'
import { LanguageSwitcher } from '@/presentation/render/page/language-switcher'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { getAnimationConfig, calculateStaggerDelay } from './html-element-helpers'
import type { ElementProps } from '.'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

/**
 * Renders language switcher component
 *
 * This is a special component that requires languages configuration from app schema.
 * If languages is not provided, renders a warning message.
 *
 * Note: Languages are already validated at server startup via AppSchema validation.
 * No need to re-validate here since the data comes from the validated app config.
 *
 * Props:
 * - variant: Display variant (dropdown, inline, tabs) - defaults to dropdown
 * - showFlags: Whether to show flag emojis - defaults to false
 * - position: Position on page (top-right, header, footer, sidebar)
 */
export function renderLanguageSwitcher(
  props: ElementProps,
  languages?: Languages,
  currentLang?: string,
  designStyles?: ComponentDesignResolution
): ReactElement {
  if (!languages) {
    // DEVELOPMENT WARNING: Keep console.warn for development debugging
    // This warning alerts developers when language-switcher component is used without languages config
    // Safe to keep - helps identify configuration issues during development
    // eslint-disable-next-line no-console -- SSR component (presentation-component) cannot import the infrastructure Logger per layer boundaries; dev-only config warning
    console.warn('language-switcher component requires languages configuration')
    return (
      <div
        style={{
          padding: '1rem',
          border: '2px dashed orange',
          color: 'orange',
          fontFamily: 'monospace',
        }}
      >
        language-switcher: missing app.languages configuration
      </div>
    )
  }

  // Extract props
  const variant = (props.variant as string | undefined) || 'dropdown'
  // Auto-enable showFlags if any language has a flag property
  const hasFlags = languages.supported.some((lang) => lang.flag)
  const showFlags = (props.showFlags as boolean | undefined) ?? hasFlags

  // The rest of `props` is markup: the author's HTML attributes and the
  // `data-component-type` stamp, which belong on the switcher's outer element.
  // The display options above are the switcher's own reading, not attributes.
  const {
    variant: _variant,
    showFlags: _showFlags,
    position: _position,
    ...attributes
  } = omitInternalMarkers(props)

  const linkPart = {
    className: designStyles?.parts['link'],
    floor: designStyles?.partFloors['link'],
  }
  // Languages already validated at server startup (start-server.ts)
  return (
    <LanguageSwitcher
      languages={languages}
      variant={variant}
      showFlags={showFlags}
      currentLang={currentLang}
      attributes={attributes}
      linkPart={linkPart}
    />
  )
}

/**
 * Renders list element with staggered fadeIn animations for items
 *
 * Parses HTML content to extract <li> elements and applies incremental
 * animation delays for a cascading appearance effect.
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML (after sanitization)
 * - Content: List item HTML from page configuration
 * - Source: Validated Page schema (list content property)
 * - Validation: `sanitizeRichTextHTML` (the canonical project-wide sanitizer)
 *   before rendering. It is DOM-free, so unlike browser `dompurify` it
 *   actually runs under Bun SSR — `dompurify` here was a silent no-op because
 *   there is no `window` on the server.
 * - XSS Protection: strips <script>/<iframe>/<object>/<embed>, inline `on*=`
 *   handlers, and `javascript:` URLs (including entity-encoded obfuscation).
 * - Process: sanitize, extract <li> tags, apply staggered animations
 *
 * @param props - Element props including data-testid
 * @param content - HTML string containing <li> elements
 * @param design - Design configuration for animation settings
 * @returns React element with list items animated with stagger effect
 */
export function renderList(
  props: ElementProps,
  content: string | undefined,
  design?: Design
): ReactElement {
  const domProps = omitInternalMarkers(props)

  if (!content) {
    return <ul {...domProps} />
  }

  const sanitizedContent = sanitizeRichTextHTML(content)
  const liMatches = sanitizedContent.match(/<li[^>]*>.*?<\/li>/gs) || []

  const animationConfig = getAnimationConfig(design)
  const duration = (animationConfig?.duration as string | undefined) || '400ms'
  const easing = (animationConfig?.easing as string | undefined) || 'ease-out'
  const staggerDelay = calculateStaggerDelay(duration)

  const renderedItems = liMatches.map((liHtml, index) => {
    const delay = `${index * staggerDelay}ms`
    const animationValue = `fade-in ${duration} ${easing} ${delay} both`
    const innerHtml = liHtml.replace(/<li[^>]*>|<\/li>/g, '')

    return (
      <li
        key={index}
        style={{ animation: animationValue }}
        // eslint-disable-next-line sovrium/require-sanitized-html -- the inner HTML of each <li> of a sanitizeRichTextHTML output
        dangerouslySetInnerHTML={{ __html: innerHtml }}
      />
    )
  })

  return <ul {...domProps}>{renderedItems}</ul>
}

/**
 * Renders list item element (li)
 *
 * Supports recursive children rendering for nested list structures.
 * Content and children can be combined - content appears first if both present.
 *
 * @param props - Element props including data-testid
 * @param content - Optional text content
 * @param children - Optional child elements (for nested lists)
 * @returns React element for list item
 */
export function renderListItem(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  const domProps = omitInternalMarkers(props)

  // If both content and children exist, render both (content first)
  if (content && children && children.length > 0) {
    return (
      <li {...domProps}>
        {content}
        {children}
      </li>
    )
  }
  // Otherwise use content or children (whichever is present)
  return <li {...domProps}>{content || children}</li>
}
