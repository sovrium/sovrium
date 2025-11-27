/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import DOMPurify from 'dompurify'
import { type ReactElement } from 'react'
import type { ElementProps } from './html-element-renderer'

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
