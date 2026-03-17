/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import DOMPurify from 'dompurify'
import * as LucideIcons from 'lucide-react'
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
 * Auth action shape for form rendering
 */
type AuthFormAction = {
  readonly type: string
  readonly method?: string
  readonly strategy?: string
  readonly provider?: string
  readonly onSuccess?: {
    readonly navigate?: string
    readonly toast?: { readonly message?: string }
  }
}

/**
 * Builds form props with auth-specific data attributes for client-side handling
 */
function buildAuthFormProps(props: ElementProps, action: AuthFormAction): Record<string, unknown> {
  return {
    ...props,
    'data-action-type': 'auth',
    'data-action-method': action.method ?? 'login',
    ...(action.onSuccess?.navigate && {
      'data-on-success-redirect': action.onSuccess.navigate,
    }),
    ...(action.onSuccess?.toast?.message && {
      'data-on-success-toast': action.onSuccess.toast.message,
    }),
    noValidate: true,
  }
}

/**
 * Determines the submit button label for an auth form method
 */
function getAuthSubmitLabel(method: string | undefined): string {
  switch (method) {
    case 'signup':
      return 'Sign Up'
    case 'resetPassword':
      return 'Send Reset Link'
    case 'setNewPassword':
      return 'Set New Password'
    default:
      return 'Sign In'
  }
}

/**
 * Renders an auth form with appropriate inputs based on the auth method:
 * - login/signup: email + password
 * - resetPassword: email only (no password)
 * - setNewPassword: password only (no email)
 */
function renderAuthForm(props: ElementProps, action: AuthFormAction): ReactElement {
  const formProps = buildAuthFormProps(props, action)
  const submitLabel = getAuthSubmitLabel(action.method)
  const isResetPassword = action.method === 'resetPassword'
  const isSetNewPassword = action.method === 'setNewPassword'
  const autocompletePassword = action.method === 'signup' ? 'new-password' : 'current-password'

  return (
    <form {...formProps}>
      {!isSetNewPassword && (
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
          />
        </label>
      )}
      {!isResetPassword && (
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete={autocompletePassword}
          />
        </label>
      )}
      <div data-error="" />
      <button type="submit">{submitLabel}</button>
    </form>
  )
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Renders an OAuth form with a single button that redirects to the OAuth provider.
 *
 * The button links to Better Auth's OAuth sign-in endpoint (/api/auth/sign-in/{provider}).
 * The form carries a data-redirect attribute when onSuccess.navigate is configured.
 */
function renderOAuthForm(props: ElementProps, action: AuthFormAction): ReactElement {
  const provider = action.provider ?? ''
  const oauthUrl = `/api/auth/sign-in/${provider}`
  const redirectTarget = action.onSuccess?.navigate

  const formProps: Record<string, unknown> = {
    ...props,
    ...(redirectTarget && { 'data-redirect': redirectTarget }),
  }

  return (
    <form {...formProps}>
      <a href={oauthUrl}>
        <button type="button">Sign in with {capitalize(provider)}</button>
      </a>
    </form>
  )
}

/**
 * Renders form element
 *
 * When an auth action is provided, generates a complete auth form with
 * email/password inputs, data attributes for client-side handling, and
 * an error display area. Non-auth forms render as simple passthroughs.
 *
 * For OAuth strategy forms, renders a single button linking to the OAuth provider.
 */
export function renderForm(
  props: ElementProps,
  children: readonly React.ReactNode[],
  action?: AuthFormAction
): ReactElement {
  if (action?.type === 'auth' && action.strategy === 'oauth') {
    return renderOAuthForm(props, action)
  }
  if (action?.type === 'auth') {
    return renderAuthForm(props, action)
  }
  return <form {...props}>{children}</form>
}

/**
 * Renders input element
 */
export function renderInput(props: ElementProps): ReactElement {
  return <input {...props} />
}

/**
 * Converts a kebab-case icon name to PascalCase for Lucide lookup
 * Example: 'check-circle' -> 'CheckCircle', 'arrow-right' -> 'ArrowRight'
 */
function kebabToPascalCase(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

/**
 * Resolves a Lucide icon component by kebab-case name.
 * Returns undefined if no matching component is found.
 *
 * Lucide icons use forwardRef, so they are objects (typeof === 'object') in the Bun runtime,
 * not plain functions. We treat both as valid React components.
 */
function resolveLucideIcon(
  iconName: string | undefined
): React.ComponentType<Record<string, unknown>> | undefined {
  if (!iconName) return undefined
  const component = (LucideIcons as Record<string, unknown>)[kebabToPascalCase(iconName)]
  // Accept both function components and forwardRef objects (which are typeof 'object')
  if (typeof component === 'function')
    return component as React.ComponentType<Record<string, unknown>>
  if (typeof component === 'object' && component !== null)
    return component as React.ComponentType<Record<string, unknown>>
  return undefined
}

/**
 * Renders icon using Lucide React icons
 *
 * Props extracted from elementProps:
 * - name: kebab-case Lucide icon name (e.g. 'check-circle', 'arrow-right')
 * - color: SVG stroke color (default: 'currentColor')
 * - size: SVG width/height in pixels (default: 24)
 * - strokeWidth: SVG stroke-width (default: 2)
 * - ariaLabel: accessible label; if provided, sets role="img" instead of aria-hidden
 * - className: CSS classes forwarded to the SVG
 *
 * Falls back to an empty SVG with data-testid for unknown icon names.
 */
export function renderIcon(
  props: ElementProps,
  _children: readonly React.ReactNode[]
): ReactElement {
  const iconName = props.name as string | undefined
  const iconColor = props.color as string | undefined
  const iconSize = props.size as number | undefined
  const iconStrokeWidth = props.strokeWidth as number | undefined
  const ariaLabel = props.ariaLabel as string | undefined

  // Build props to forward to the SVG — strip out icon-specific props and their data-* conversions
  const {
    name: _name,
    color: _color,
    size: _size,
    strokeWidth: _strokeWidth,
    ariaLabel: _ariaLabel,
    'data-color': _dataColor,
    'data-size': _dataSize,
    'data-stroke-width': _dataStrokeWidth,
    'data-aria-label': _dataAriaLabel,
    ...restProps
  } = props as Record<string, unknown>

  const testId = iconName ? `icon-${iconName}` : 'icon'
  const colorProps = iconColor !== undefined ? { 'data-color': iconColor } : {}
  const a11yProps = ariaLabel
    ? { role: 'img' as const, 'aria-label': ariaLabel }
    : { 'aria-hidden': 'true' as const }

  const LucideIcon = resolveLucideIcon(iconName)

  if (LucideIcon) {
    return (
      <LucideIcon
        {...restProps}
        {...a11yProps}
        {...colorProps}
        size={iconSize ?? 24}
        color={iconColor ?? 'currentColor'}
        strokeWidth={iconStrokeWidth ?? 2}
        data-testid={testId}
      />
    ) as ReactElement
  }

  // Fallback: render empty SVG placeholder for unknown icons
  return (
    <svg
      {...(restProps as React.SVGProps<SVGSVGElement>)}
      {...a11yProps}
      {...colorProps}
      data-testid={testId}
      xmlns="http://www.w3.org/2000/svg"
      width={iconSize ?? 24}
      height={iconSize ?? 24}
    />
  )
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
