/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import {
  computeFormClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '../recipes/forms-default-classes'
import type { ElementProps } from '../html-element-renderer'
import type { Component } from '@/domain/models/app/pages/components'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'

interface EndpointConfig {
  readonly url: string
  readonly method?: 'POST' | 'PUT' | 'PATCH'
  readonly responseEnvelope?: string
  readonly submitLabel?: string
  readonly onSuccess?: unknown
  readonly onError?: unknown
}

interface SerializedEndpointConfig {
  readonly url: string
  readonly method: string
  readonly responseEnvelope?: string
  readonly onSuccess?: unknown
  readonly onError?: unknown
}

const CONTROL_CLASS =
  'border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none'

type EndpointFieldOption = { readonly value: string; readonly label?: string }

function renderEndpointControl(field: FormFieldConfig): ReactElement {
  const name = field.field
  if (field.control === 'select') {
    const options = (field.options ?? []) as readonly EndpointFieldOption[]
    return (
      <select
        name={name}
        className={CONTROL_CLASS}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label ?? option.value}
          </option>
        ))}
      </select>
    )
  }
  if (field.control === 'textarea') {
    return (
      <textarea
        name={name}
        className={CONTROL_CLASS}
      />
    )
  }
  return (
    <input
      type={field.control ?? 'text'}
      name={name}
      className={CONTROL_CLASS}
    />
  )
}

function renderEndpointField(field: FormFieldConfig): ReactElement {
  return (
    <label
      key={field.field}
      className={computeFormFieldClasses()}
    >
      <span className={computeFormFieldLabelClasses()}>{field.label ?? field.field}</span>
      {renderEndpointControl(field)}
    </label>
  )
}

function buildEndpointConfig(endpoint: EndpointConfig): SerializedEndpointConfig {
  return {
    url: endpoint.url,
    method: endpoint.method ?? 'POST',
    ...(endpoint.responseEnvelope !== undefined && {
      responseEnvelope: endpoint.responseEnvelope,
    }),
    ...(endpoint.onSuccess !== undefined && { onSuccess: endpoint.onSuccess }),
    ...(endpoint.onError !== undefined && { onError: endpoint.onError }),
  }
}

export function renderEndpointForm(
  props: ElementProps,
  component: Component | undefined
): ReactElement | undefined {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  const endpoint = componentRecord['endpoint'] as EndpointConfig | undefined
  if (!endpoint || typeof endpoint.url !== 'string') return undefined

  const fields = (componentRecord['fields'] ?? []) as readonly FormFieldConfig[]
  const authorClassName = props.className as string | undefined
  const mergedClassName = authorClassName
    ? `${computeFormClasses()} ${authorClassName}`
    : computeFormClasses()
  const endpointConfigJson = JSON.stringify(buildEndpointConfig(endpoint))

  return (
    <form
      {...props}
      className={mergedClassName}
      data-action-type="endpoint"
      data-endpoint-config={endpointConfigJson}
    >
      {fields.map((field) => renderEndpointField(field))}
      <button type="submit">{endpoint.submitLabel ?? 'Envoyer'}</button>
    </form>
  )
}
