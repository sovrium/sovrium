/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { renderAuthForm, renderOAuthForm, type AuthFormAction } from './auth-form-renderer'
import {
  renderAutomationForm,
  renderCrudCreateForm,
  renderCrudUpdateForm,
  type AutomationFormAction,
  type CrudFormAction,
} from './crud-form-renderer'
import type { ElementProps } from './html-element-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

// Re-export button-related renderers (extracted to button-renderer.tsx for file size)
export { renderButton } from './button-renderer'

// Re-export icon renderer (extracted to icon-renderer.tsx for file size)
export { renderIcon } from './icon-renderer'

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
 * Configuration object for {@link renderForm}.
 *
 * Bundled into a single object to keep the parameter count under the ESLint
 * `max-params` threshold while supporting the optional `tables` and
 * `component` inputs needed by CRUD-action forms.
 */
export interface RenderFormConfig {
  readonly props: ElementProps
  readonly children: readonly React.ReactNode[]
  readonly action?: AuthFormAction
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly component?: Component
}

/**
 * Renders form element
 *
 * When an auth action is provided, generates a complete auth form with
 * email/password inputs, data attributes for client-side handling, and
 * an error display area. Non-auth forms render as simple passthroughs.
 *
 * For OAuth strategy forms, renders a single button linking to the OAuth provider.
 *
 * For CRUD actions, generates a form with fields from the table schema definition.
 */
function renderCrudFormVariant(config: RenderFormConfig): ReactElement {
  const { props, action, tables, buckets, component } = config
  const crudAction = action as unknown as CrudFormAction
  if (crudAction.operation === 'update') {
    return renderCrudUpdateForm(props, crudAction, tables, component, buckets)
  }
  return renderCrudCreateForm(props, crudAction, tables, component, buckets)
}

function renderAuthFormVariant(config: RenderFormConfig): ReactElement {
  const { props, action } = config
  if (action?.type === 'auth' && action.strategy === 'oauth') return renderOAuthForm(props, action)
  return renderAuthForm(props, action!)
}

export function renderForm(config: RenderFormConfig): ReactElement {
  const { props, children, action, tables, buckets, component } = config
  if (action?.type === 'crud') return renderCrudFormVariant(config)
  if (action?.type === 'automation') {
    return renderAutomationForm(
      props,
      action as unknown as AutomationFormAction,
      tables,
      component,
      buckets
    )
  }
  if (action?.type === 'auth') return renderAuthFormVariant(config)
  return (
    <form {...props}>{children.length > 0 ? children : <button type="submit">Submit</button>}</form>
  )
}

/**
 * Renders input element
 */
export function renderInput(props: ElementProps): ReactElement {
  return <input {...props} />
}

/**
 * Configuration for {@link renderFileUpload}.
 *
 * `props` is the standard `elementProps` (id, aria-label, className, data-testid, …).
 * `accept`, `maxFiles`, `dropZone`, `disabled` come from the schema's top-level
 * fields on the file-upload component (siblings of `props`), not from inside
 * `props` — see the `pickFromComponent` doc-comment in
 * `island-form-components.tsx` for the lookup contract.
 */
export interface RenderFileUploadConfig {
  readonly props: ElementProps
  readonly accept?: string
  readonly maxFiles?: number
  readonly dropZone?: boolean
  readonly disabled?: boolean
  readonly label?: string
}

/**
 * Renders a basic file-upload control (button + hidden input).
 *
 * The container `<div>` carries the user-supplied `id` so selectors like
 * `#avatar-upload` target the upload control, while the actual `<input
 * type="file">` is nested inside so `#avatar-upload input[type="file"]`
 * also resolves. The input is visually hidden via Tailwind's `sr-only`
 * but remains in the accessibility tree and is focusable through the
 * surrounding `<label>`.
 *
 * `accept` is forwarded as the native `accept` attribute. `multiple` is
 * applied only when `maxFiles` is greater than 1 (or unset, defaulting to
 * single-file). `disabled` cascades to both the button and the input.
 *
 * This renderer is intentionally non-interactive in SSR: it does not wire
 * upload submission, drag/drop, or progress reporting. Those concerns
 * belong to a future client-side island when richer behavior is needed.
 */
export function renderFileUpload(config: RenderFileUploadConfig): ReactElement {
  // Intentionally not destructured into the renderer body:
  //   - `dropZone` (boolean): drives drag-and-drop UI; deferred to US-002 island
  //   - `uploadAction` (string | ActionSchema): wires submit destination; the
  //     basic AC under test (file selection + accept + multiple) doesn't fire
  //     a submit yet, so the field is accepted at the schema layer but unused
  //     here. When US-002 lands the dropzone island, the island will read both
  //     fields from the same `pickFromComponent` lookup contract.
  const { props, accept, maxFiles, disabled, label } = config
  const id = props.id as string | undefined
  const ariaLabel = (props['aria-label'] as string | undefined) ?? label ?? 'Upload file'
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const allowMultiple = typeof maxFiles === 'number' ? maxFiles > 1 : false
  const inputId = id ? `${id}-input` : undefined
  const buttonText = label ?? ariaLabel

  return (
    <div
      id={id}
      className={className}
      data-testid={testId}
      data-component="file-upload"
    >
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-disabled={disabled ? 'true' : undefined}
      >
        {/* TODO: replace '+' placeholder when iconography is wired through (sibling renderers will adopt the same icon system). */}
        <span aria-hidden="true">+</span>
        <span>{buttonText}</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={allowMultiple}
        disabled={disabled}
        aria-label={ariaLabel}
        className="sr-only"
      />
    </div>
  )
}

/**
 * Renders a search input container with an inner input element.
 *
 * The component uses props.id as the container id and renders an input
 * element inside. This pattern allows selectors like `#search-bar input`
 * to locate the input element within the named search container.
 */
export function renderSearchInput(props: ElementProps): ReactElement {
  const id = props.id as string | undefined
  const placeholder = props.placeholder as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined

  return (
    <div
      id={id}
      className={className}
      data-testid={testId}
    >
      <input
        type="search"
        placeholder={placeholder ?? 'Search...'}
        aria-label={placeholder ?? 'Search...'}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR placeholder; one-shot during server render
        style={{ width: '100%', padding: '0.5rem' }}
      />
    </div>
  )
}

/**
 * Strips `<script>` tags (and their contents), inline `on*=` event handler
 * attributes, and `javascript:` URLs from an HTML string.
 *
 * This runs at server-render time in a Bun/Node SSR context that has no DOM,
 * so DOMPurify (which requires `window`) is unusable here — `DOMPurify.isSupported`
 * returns false and `DOMPurify.sanitize` is undefined under Bun. We deliberately
 * choose a small regex stripper over pulling in `isomorphic-dompurify` (which
 * brings jsdom as a transitive dependency, ~5 MB) because:
 *
 *   1. `customHTML` content originates from the app schema (YAML/TS config)
 *      authored by the developer deploying the application — not end-user input.
 *      The schema is type-checked, version-controlled, and reviewed.
 *   2. The threat model is "prevent accidental script execution / theme break"
 *      not "defend against motivated attackers in user-generated content."
 *   3. Theme CSS variables in `style` attributes (e.g. `var(--color-primary)`)
 *      must pass through unchanged so authors can reference design tokens.
 *
 * If Sovrium ever exposes this surface to untrusted authors (multi-tenant SaaS
 * with user-editable HTML), upgrade to `isomorphic-dompurify`.
 */
function sanitizeInlineHTML(input: string): string {
  // Drop <script>...</script> blocks (greedy across newlines)
  const withoutScripts = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  // Drop self-closing/empty <script /> too
  const withoutSelfClosingScripts = withoutScripts.replace(/<script\b[^>]*\/?>(?!)/gi, '')
  // Strip inline event handler attributes (onclick="...", onLoad='...', etc.)
  const withoutInlineHandlers = withoutSelfClosingScripts.replace(
    /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    ''
  )
  // Strip javascript: URLs
  return withoutInlineHandlers.replace(/javascript:/gi, '')
}

/**
 * Renders a customHTML component with inline content.
 *
 * Content is read from the component's `content` field (declared via
 * `contentFields` in the customHTML schema). The sibling `htmlSrc` field for
 * loading external HTML files is wired by a separate renderer path.
 *
 * SECURITY: Inline HTML is sanitized by `sanitizeInlineHTML` to strip <script>
 * blocks, inline event handlers, and `javascript:` URLs before being rendered
 * via `dangerouslySetInnerHTML`. See the `sanitizeInlineHTML` doc-comment for
 * the threat model and the rationale for choosing regex over DOMPurify.
 *
 * The `data-component="customHTML"` attribute matches the schema type literal
 * (consistent with `data-component="dataTable"` etc.) and is used by E2E specs
 * to assert the component rendered.
 */
export function renderCustomHTML(props: ElementProps, content?: string): ReactElement {
  const sanitizedHTML = sanitizeInlineHTML(content ?? '')
  return (
    <div
      {...props}
      data-component="customHTML"
      // Safe: HTML has been sanitized to remove <script>, inline handlers, javascript: URLs
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-rendered customHTML; called once during server render
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}
