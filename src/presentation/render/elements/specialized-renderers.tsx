/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-object-as-prop --
 * This file is a collection of stateless SSR render-helper functions, not
 * React components. Each helper is invoked once per element during a single
 * server render pass (and inside loops where per-iteration object props are
 * unavoidable). There are no client-side re-renders to memoize against, so
 * the inline-prop perf rule does not apply.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { type Design } from '@/domain/models/app/design'
import { type Languages } from '@/domain/models/app/languages'
import { LanguageSwitcher } from '@/presentation/render/page/language-switcher'
import { omitInternalMarkers } from '../props/internal-marker-props'
import {
  getAnimationConfig,
  calculateStaggerDelay,
  buildAlertVariantStyles,
} from './html-element-helpers'
import type { ElementProps } from '.'

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
  currentLang?: string
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

  // Languages already validated at server startup (start-server.ts)
  return (
    <LanguageSwitcher
      languages={languages}
      variant={variant}
      showFlags={showFlags}
      currentLang={currentLang}
    />
  )
}

/**
 * Renders alert element with variant support
 *
 * Creates an alert component with semantic variants (success, danger, warning, info).
 * The variant prop determines the visual styling based on design colors.
 * Uses inline styles derived from design tokens for color variants.
 *
 * When `props.dismissible === true`, the alert is wrapped with a stable
 * `data-alert-id` and an accessible close button is appended. The close
 * button rides the existing body-end `clickScript` (page-body-scripts.tsx)
 * by carrying `data-click-toggle-element`, so no new client script or
 * static-asset route is needed (the toggle handler is event-delegated at
 * the document level).
 *
 * @param props - Element props including variant, dismissible, and data-testid
 * @param content - Alert message text
 * @param children - Optional child elements
 * @param design - Design configuration for color resolution
 * @returns React element for alert component
 */
export function renderAlert(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[],
  design?: Design
): ReactElement {
  const variant = props.variant as string | undefined
  const dismissible = props.dismissible === true
  const existingStyle = (props.style as Record<string, unknown> | undefined) || {}

  // Strip `dismissible` from the spread so it does not become an invalid DOM
  // attribute (React would log a warning, and even if quietly stripped, it
  // wouldn't serve the spec — the toggle target is the alert itself via
  // `data-alert-id`).
  const { dismissible: _dismissible, ...domProps } = omitInternalMarkers(props) as ElementProps & {
    dismissible?: unknown
  }

  // Merge existing styles with variant styles
  const mergedStyle = {
    padding: '12px 16px',
    borderRadius: '4px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    ...buildAlertVariantStyles(variant, design),
    ...existingStyle,
  }

  // Stable id so the close button can target this specific alert from the
  // event-delegated clickScript. Server-side only — no hydration to mismatch.
  const alertId = dismissible ? crypto.randomUUID() : undefined

  return (
    <div
      {...domProps}
      {...(alertId ? { 'data-alert-id': alertId } : {})}
      role="alert"
      style={mergedStyle}
    >
      <span style={{ flex: 1 }}>{content || children}</span>
      {dismissible && alertId && (
        <button
          type="button"
          aria-label="Dismiss"
          data-click-toggle-element={`[data-alert-id="${alertId}"]`}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: '18px',
            lineHeight: 1,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      )}
    </div>
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
