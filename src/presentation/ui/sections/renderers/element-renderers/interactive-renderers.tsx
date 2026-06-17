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
import { computeFormClasses } from './forms-default-classes'
import {
  computeSearchInputContainerClasses,
  computeSearchInputFieldClasses,
} from './interactive-content-default-classes'
import type { ElementProps } from './html-element-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Languages } from '@/domain/models/app/languages'
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
  readonly lang?: string
  readonly languages?: Languages
  readonly landingPath?: string
}

function renderCrudFormVariant(config: RenderFormConfig): ReactElement {
  const { props, action, tables, buckets, component, lang, languages } = config
  const crudAction = action as unknown as CrudFormAction
  const renderContext = { lang, languages }
  if (crudAction.operation === 'update') {
    return renderCrudUpdateForm(props, crudAction, tables, component, buckets, renderContext)
  }
  return renderCrudCreateForm(props, crudAction, tables, component, buckets, renderContext)
}

function renderAuthFormVariant(config: RenderFormConfig): ReactElement {
  const { props, action, tables, component, lang, languages, landingPath } = config
  if (action?.type === 'auth' && action.strategy === 'oauth') return renderOAuthForm(props, action)
  return renderAuthForm(props, action!, { tables, component, lang, languages, landingPath })
}

function maybeSynthesizeCrudUpdateAction(config: RenderFormConfig): RenderFormConfig['action'] {
  if (config.action) return config.action
  const componentRecord = (config.component ?? {}) as Record<string, unknown>
  const dataSource = componentRecord['dataSource'] as
    | { readonly table?: string; readonly mode?: string }
    | undefined
  if (!dataSource || dataSource.mode !== 'single' || typeof dataSource.table !== 'string') {
    return undefined
  }
  return {
    type: 'crud',
    operation: 'update',
    table: dataSource.table,
  } as RenderFormConfig['action']
}

function maybeApplySaveButtonDefault(config: RenderFormConfig): RenderFormConfig {
  const componentRecord = (config.component ?? {}) as Record<string, unknown>
  const existingProps = (componentRecord['props'] as Record<string, unknown> | undefined) ?? {}
  if (typeof existingProps['label'] === 'string') return config
  return {
    ...config,
    component: {
      ...componentRecord,
      props: { ...existingProps, label: 'Save' },
    } as RenderFormConfig['component'],
  }
}

function renderBareFormVariant(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  const authorClassName = props.className as string | undefined
  const mergedClassName = authorClassName
    ? `${computeFormClasses()} ${authorClassName}`
    : computeFormClasses()
  return (
    <form
      {...props}
      className={mergedClassName}
    >
      {children.length > 0 ? children : <button type="submit">Submit</button>}
    </form>
  )
}

export function renderForm(config: RenderFormConfig): ReactElement {
  const synthesizedAction = maybeSynthesizeCrudUpdateAction(config)
  const synthesized = synthesizedAction !== config.action
  const withAction = synthesized ? { ...config, action: synthesizedAction } : config
  const effectiveConfig = synthesized ? maybeApplySaveButtonDefault(withAction) : withAction
  const { props, children, action, tables, buckets, component } = effectiveConfig
  if (action?.type === 'crud') return renderCrudFormVariant(effectiveConfig)
  if (action?.type === 'automation') {
    return renderAutomationForm(
      props,
      action as unknown as AutomationFormAction,
      tables,
      component,
      buckets
    )
  }
  if (action?.type === 'auth') return renderAuthFormVariant(effectiveConfig)
  return renderBareFormVariant(props, children)
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
        className="border-border bg-background text-foreground hover:bg-background-subtle inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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

  const containerDefaults = computeSearchInputContainerClasses()
  const containerClassName = className ? `${containerDefaults} ${className}` : containerDefaults
  const fieldClassName = computeSearchInputFieldClasses()

  return (
    <div
      id={id}
      className={containerClassName}
      data-testid={testId}
    >
      <input
        type="search"
        placeholder={placeholder ?? 'Search...'}
        aria-label={placeholder ?? 'Search...'}
        className={fieldClassName}
      />
    </div>
  )
}

export interface RenderPageSearchConfig {
  readonly props: ElementProps
  readonly placeholder?: string
  readonly maxResults?: number
}

export function renderPageSearch(config: RenderPageSearchConfig): ReactElement {
  const { props, placeholder, maxResults } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const effectivePlaceholder = placeholder ?? 'Search...'

  const containerDefaults = computeSearchInputContainerClasses()
  const containerClassName = className ? `${containerDefaults} ${className}` : containerDefaults
  const fieldClassName = computeSearchInputFieldClasses()

  const islandProps = {
    placeholder: effectivePlaceholder,
    ...(typeof maxResults === 'number' ? { maxResults } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(className !== undefined ? { className } : {}),
    ...(testId !== undefined ? { 'data-testid': testId } : {}),
  }
  const propsJson = JSON.stringify(islandProps)

  return (
    <div
      id={id}
      className={containerClassName}
      data-testid={testId}
      data-island="page-search"
      data-island-props={propsJson}
    >
      <input
        type="search"
        placeholder={effectivePlaceholder}
        aria-label={effectivePlaceholder}
        className={fieldClassName}
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
