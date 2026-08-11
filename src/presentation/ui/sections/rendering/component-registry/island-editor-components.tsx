/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'
import type { ReactNode } from 'react'

type ElemProps = Record<string, unknown>
type EditorIsland =
  'schema-json-editor' | 'schema-yaml-editor' | 'schema-form-editor' | 'schema-ai-agent'

/**
 * SSR placeholders for the schema config-editor islands (platform B10).
 *
 * Each editor type defines its fields at the component top level (siblings of
 * `props`), so the renderer reads them from `component` directly. Each emits a
 * `<div data-island="schema-{json,yaml,form,ai-agent}-editor" data-island-props="...">`
 * marker; the island client discovers the marker and mounts the interactive
 * editor (CodeMirror, the structured form builder, or the AI chat surface).
 *
 * The placeholders ship the same interactive controls the hydrated island will
 * own (Submit button / Send button + textbox) so the markup is stable across
 * hydration and Playwright role queries resolve immediately.
 */

function pick(component: Record<string, unknown>, key: string): unknown {
  return component[key]
}

/**
 * Read the render-time-only `_submitContext` map stamped by
 * `editor-context-resolver.ts` (GAP-I2). It holds the resolved `inlinePrefill`
 * `$record.<field>` tokens as literal column → value pairs; the editor island
 * merges it into the records POST body so the editor's submit carries the page
 * record FK. Defensive: only a non-null object is forwarded.
 */
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

  // json / yaml / form share a code/form skeleton + a disabled Submit button.
  return renderMarker(island, elementProps, props, [
    <div
      key="skeleton"
      className="bg-background-subtle h-40 w-full animate-pulse rounded"
    />,
    <div key="action">{renderSubmitSkeleton('Submit')}</div>,
  ])
}

/** Schema config-editor island components (JSON / YAML / form / AI-agent). */
export const islandEditorComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> =
  {
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
