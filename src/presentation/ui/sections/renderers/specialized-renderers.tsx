/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import { type Languages } from '@/domain/models/app/languages'
import { type Theme } from '@/domain/models/app/theme'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { LanguageSwitcher } from '@/presentation/ui/languages/language-switcher'
import {
  getAnimationConfig,
  calculateStaggerDelay,
  buildAlertVariantStyles,
} from './html-element-helpers'
import type { ElementProps } from './element-renderers'

export function renderLanguageSwitcher(props: ElementProps, languages?: Languages): ReactElement {
  if (!languages) {
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

  const variant = (props.variant as string | undefined) || 'dropdown'
  const hasFlags = languages.supported.some((lang) => lang.flag)
  const showFlags = (props.showFlags as boolean | undefined) ?? hasFlags

  return (
    <LanguageSwitcher
      languages={languages}
      variant={variant}
      showFlags={showFlags}
    />
  )
}

export function renderAlert(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[],
  theme?: Theme
): ReactElement {
  const variant = props.variant as string | undefined
  const dismissible = props.dismissible === true
  const existingStyle = (props.style as Record<string, unknown> | undefined) || {}

  const { dismissible: _dismissible, ...domProps } = props as ElementProps & {
    dismissible?: unknown
  }

  const mergedStyle = {
    padding: '12px 16px',
    borderRadius: '4px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    ...buildAlertVariantStyles(variant, theme),
    ...existingStyle,
  }

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

export function renderList(
  props: ElementProps,
  content: string | undefined,
  theme?: Theme
): ReactElement {
  if (!content) {
    return <ul {...props} />
  }

  const sanitizedContent = sanitizeRichTextHTML(content)
  const liMatches = sanitizedContent.match(/<li[^>]*>.*?<\/li>/gs) || []

  const animationConfig = getAnimationConfig(theme)
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

  return <ul {...props}>{renderedItems}</ul>
}

export function renderUnorderedList(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <ul {...props}>{content || children}</ul>
}

export function renderListItem(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  if (content && children && children.length > 0) {
    return (
      <li {...props}>
        {content}
        {children}
      </li>
    )
  }
  return <li {...props}>{content || children}</li>
}
