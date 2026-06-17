/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactNode } from 'react'

type ElemProps = Record<string, unknown>
type EditorIsland =
  | 'schema-json-editor'
  | 'schema-yaml-editor'
  | 'schema-form-editor'
  | 'schema-ai-agent'


function pick(component: Record<string, unknown>, key: string): unknown {
  return component[key]
}

function pickSubmitContext(
  component: Record<string, unknown>
): Record<string, unknown> | undefined {
  const value = component['_submitContext']
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

function buildEditorProps(component: Record<string, unknown>, elementProps: ElemProps) {
  const submitContext = pickSubmitContext(component)
  return {
    submitToTable: pick(component, 'submitToTable'),
    configField: pick(component, 'configField'),
    formatField: pick(component, 'formatField'),
    initialValue: pick(component, 'initialValue'),
    height: pick(component, 'height'),
    lineNumbers: pick(component, 'lineNumbers'),
    readOnly: pick(component, 'readOnly'),
    sections: pick(component, 'sections'),
    placeholder: pick(component, 'placeholder'),
    chatHeight: pick(component, 'chatHeight'),
    ...(submitContext !== undefined ? { submitContext } : {}),
    className: elementProps.className,
    id: elementProps.id,
    'data-testid': elementProps['data-testid'],
  }
}

function renderMarker(
  island: EditorIsland,
  elementProps: ElemProps,
  props: ReturnType<typeof buildEditorProps>,
  body: ReactNode
) {
  return (
    <div
      data-island={island}
      data-island-props={JSON.stringify(props)}
      data-testid={elementProps['data-testid'] as string | undefined}
      id={elementProps.id as string | undefined}
      className={elementProps.className as string | undefined}
    >
      <div className="border-border bg-background-raised flex flex-col gap-3 rounded-md border p-3">
        {body}
      </div>
    </div>
  )
}

function renderSubmitSkeleton(label: string) {
  return (
    <div>
      <button
        type="button"
        disabled
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium opacity-50"
      >
        {label}
      </button>
    </div>
  )
}

function renderEditorPlaceholder(
  island: EditorIsland,
  component: Record<string, unknown>,
  elementProps: ElemProps
) {
  const props = buildEditorProps(component, elementProps)

  if (island === 'schema-ai-agent') {
    return renderMarker(island, elementProps, props, [
      <textarea
        key="input"
        disabled
        placeholder={props.placeholder as string | undefined}
        className="border-border bg-background h-40 w-full resize-none rounded px-3 py-2 text-sm"
      />,
      <div key="action">{renderSubmitSkeleton('Send')}</div>,
    ])
  }

  return renderMarker(island, elementProps, props, [
    <div
      key="skeleton"
      className="bg-background-subtle h-40 w-full animate-pulse rounded"
    />,
    <div key="action">{renderSubmitSkeleton('Submit')}</div>,
  ])
}

export const islandEditorComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  'schema-json-editor': ({ component, elementProps }) =>
    renderEditorPlaceholder(
      'schema-json-editor',
      (component ?? {}) as Record<string, unknown>,
      elementProps
    ),
  'schema-yaml-editor': ({ component, elementProps }) =>
    renderEditorPlaceholder(
      'schema-yaml-editor',
      (component ?? {}) as Record<string, unknown>,
      elementProps
    ),
  'schema-form-editor': ({ component, elementProps }) =>
    renderEditorPlaceholder(
      'schema-form-editor',
      (component ?? {}) as Record<string, unknown>,
      elementProps
    ),
  'schema-ai-agent': ({ component, elementProps }) =>
    renderEditorPlaceholder(
      'schema-ai-agent',
      (component ?? {}) as Record<string, unknown>,
      elementProps
    ),
}
