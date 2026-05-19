/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
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

export { renderButton } from './button-renderer'

export { renderIcon } from './icon-renderer'

export function renderLink(
  props: ElementProps,
  content: string | undefined,
  children: readonly React.ReactNode[]
): ReactElement {
  return <a {...props}>{content || children}</a>
}

export interface RenderFormConfig {
  readonly props: ElementProps
  readonly children: readonly React.ReactNode[]
  readonly action?: AuthFormAction
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly component?: Component
}

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

export function renderInput(props: ElementProps): ReactElement {
  return <input {...props} />
}

export interface RenderFileUploadConfig {
  readonly props: ElementProps
  readonly accept?: string
  readonly maxFiles?: number
  readonly dropZone?: boolean
  readonly disabled?: boolean
  readonly label?: string
}

export function renderFileUpload(config: RenderFileUploadConfig): ReactElement {
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
        {}
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
        style={{ width: '100%', padding: '0.5rem' }}
      />
    </div>
  )
}

export function renderCustomHTML(
  props: ElementProps,
  content?: string,
  trusted = false
): ReactElement {
  const sanitizedHTML = trusted ? (content ?? '') : sanitizeRichTextHTML(content ?? '')
  return (
    <div
      {...props}
      data-component="customHTML"
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}
