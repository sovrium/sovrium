/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve the config-editor record-context channel (GAP-I2,
 * [internal ref]).
 *
 * The four config-editor component types (`schema-json-editor`,
 * `schema-yaml-editor`, `schema-form-editor`, `schema-ai-agent`) carry an
 * optional `inlinePrefill` block reusing the same `InlinePrefillSchema`
 * (`$record.<field>` token + `lockPrefill`) already on `form` / `dialog`.
 *
 * At page-render time — when the host page's `dataSource: { mode: 'single' }`
 * (or `collection`) record is available — this pass resolves the
 * `$record.<field>` tokens against that record into a literal `submitContext`
 * map and stashes it on a render-time-only `_submitContext` field. The editor
 * SSR dispatcher (`island-editor-components.tsx`) reads `_submitContext` and
 * emits it in `data-island-props`; the editor island merges it into the POST
 * body so the editor's submit carries the page record FK alongside
 * `configField` + `formatField`.
 *
 * Resolution mirrors the embedded-form `inlinePrefill` flow via the shared
 * `resolveRecordPrefillMap` — no new token grammar, no parallel schema.
 *
 * `lockPrefill: true` here is a render-time, client-side contract: the resolved
 * values are computed from SSR props (never client input), baked into the
 * island's `submitContext`, and the submit helper merges them LAST — after the
 * editor's own fields — so the editor's UI fields cannot accidentally clobber
 * the FK. This is weaker than the embedded-form `lockPrefill`: that path posts
 * to `/api/forms/*` where `revalidateInlinePrefillParent` re-checks the host
 * record server-side. The editor posts to the generic `/api/tables/<t>/records`
 * route, which has NO inline-prefill revalidation — so a *tampered* client (one
 * that rewrites the island's submit body) can still POST an arbitrary FK,
 * exactly as it could call the records API directly. Enforcement is therefore
 * the records route's normal table create-permission + FK-existence checks, not
 * the prefill lock. Do not rely on this channel for trust boundaries.
 */

import {
  isInlinePrefill,
  resolveRecordPrefillMap,
  type PrefillValue,
} from '@/presentation/rendering/forms/record-prefill-resolver'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** The four config-editor component types that support `inlinePrefill`. */
const EDITOR_TYPES = new Set<Component['type']>([
  'schema-json-editor',
  'schema-yaml-editor',
  'schema-form-editor',
  'schema-ai-agent',
])

/**
 * Optional context threaded through `resolveEditorContext`. `parentRecord`
 * is the host page's single-mode / collection record; when undefined, the
 * editor's `$record.*` prefill tokens drop out and no `submitContext` is
 * emitted.
 */
export interface EditorContextResolution {
  readonly parentRecord?: Readonly<Record<string, unknown>>
}

/**
 * Resolve a single editor component's `inlinePrefill` into a literal
 * `_submitContext` map stashed on the component. Returns the component
 * unchanged when it is not a config-editor, lacks `inlinePrefill`, or when
 * every token resolved away (no host record / missing segment).
 */
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

/**
 * Walk a component subtree (and any `children`), resolving every config-editor
 * component's `inlinePrefill` tokens against the host record. Component
 * references (`{ component }` / `{ $ref }`) and string children pass through
 * unchanged.
 */
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

/**
 * Resolve the record-context `inlinePrefill` of every config-editor on a page
 * into a literal `_submitContext` map. Mirrors `expandFormRefs` — a render-time
 * pass that runs while the host page's parent record is in scope.
 */
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
