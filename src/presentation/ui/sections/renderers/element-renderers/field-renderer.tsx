/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { ElementProps } from './html-element-renderer'
import type { Component } from '@/domain/models/app/pages/components'

export interface RenderFieldConfig {
  readonly props: ElementProps
  readonly fieldLabel?: string
  readonly fieldDescription?: string
  readonly fieldError?: string
  readonly required?: boolean
  readonly controlId?: string
  readonly children: readonly React.ReactNode[]
}

export function renderField(config: RenderFieldConfig): ReactElement {
  const { props, fieldLabel, fieldDescription, fieldError, required, controlId, children } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined

  return (
    <div
      id={id}
      className={className}
      data-testid={testId}
      data-component="field"
    >
      {fieldLabel !== undefined && (
        <label htmlFor={controlId}>{required ? `${fieldLabel} *` : fieldLabel}</label>
      )}
      {fieldDescription !== undefined && (
        <p
          className="text-sm text-gray-500"
          id={controlId ? `${controlId}-description` : undefined}
        >
          {fieldDescription}
        </p>
      )}
      {children}
      {fieldError !== undefined && (
        <p
          className="text-sm text-red-600"
          role="alert"
          id={controlId ? `${controlId}-error` : undefined}
        >
          {fieldError}
        </p>
      )}
    </div>
  )
}

export function extractFirstChildId(component: Component | undefined): string | undefined {
  const children = (component as { children?: readonly unknown[] } | undefined)?.children
  if (!Array.isArray(children) || children.length === 0) return undefined
  const firstChild = children[0] as { props?: { id?: string } } | undefined
  return firstChild?.props?.id
}

export interface RenderTextareaConfig {
  readonly props: ElementProps
  readonly rows?: number
  readonly maxLength?: number
  readonly label?: string
  readonly autoResize?: boolean
  readonly placeholder?: string
  readonly name?: string
}

export function renderTextarea(config: RenderTextareaConfig): ReactElement {
  const { props, rows, maxLength, label, autoResize, placeholder, name } = config
  const { label: _label, ...restProps } = props as ElementProps & { label?: unknown }
  const ariaLabel = label ?? (restProps['aria-label'] as string | undefined)
  const dataAutoResize = autoResize === true ? '' : undefined

  return (
    <textarea
      {...restProps}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder ?? (restProps['placeholder'] as string | undefined)}
      name={name ?? (restProps['name'] as string | undefined)}
      aria-label={ariaLabel}
      data-auto-resize={dataAutoResize}
    />
  )
}
