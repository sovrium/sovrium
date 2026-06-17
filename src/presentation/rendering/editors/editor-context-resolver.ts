/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  isInlinePrefill,
  resolveRecordPrefillMap,
  type PrefillValue,
} from '@/presentation/rendering/forms/record-prefill-resolver'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

const EDITOR_TYPES = new Set<Component['type']>([
  'schema-json-editor',
  'schema-yaml-editor',
  'schema-form-editor',
  'schema-ai-agent',
])

export interface EditorContextResolution {
  readonly parentRecord?: Readonly<Record<string, unknown>>
}

function resolveEditorComponent(component: Component, ctx: EditorContextResolution): Component {
  if (!EDITOR_TYPES.has(component.type)) return component
  const inlinePrefillRaw = (component as { readonly inlinePrefill?: unknown }).inlinePrefill
  if (!isInlinePrefill(inlinePrefillRaw)) return component

  const submitContext: Readonly<Record<string, PrefillValue>> = resolveRecordPrefillMap(
    inlinePrefillRaw,
    ctx.parentRecord
  )
  if (Object.keys(submitContext).length === 0) return component

  return { ...(component as Record<string, unknown>), _submitContext: submitContext } as Component
}

function resolveEditorInComponent(component: Component, ctx: EditorContextResolution): Component {
  const resolved = resolveEditorComponent(component, ctx)
  if (!resolved.children || resolved.children.length === 0) return resolved
  return {
    ...resolved,
    children: resolved.children.map((child: Component | string) =>
      typeof child === 'string' ? child : resolveEditorInComponent(child, ctx)
    ),
  }
}

export function resolveEditorContext(
  components: Page['components'],
  ctx: EditorContextResolution = {}
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    return resolveEditorInComponent(item as Component, ctx)
  })
}
