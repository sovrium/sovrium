/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Auto-bind `table` + `recordId` props on `comments` (either display)
 * components when they appear on a page bound to ONE record. The page binds
 * the comments thread to that record by convention: schema authors should not
 * need to repeat `table: 'posts', recordId: '$record.id'` in every `props`
 * block. Explicit author values are preserved when present — and an explicit
 * `recordId` naming the page record (`$record.id`) is resolved against it, on
 * the component and in its `props` alike, so the thread, its composer and the
 * count display all address the row rather than the literal reference.
 *
 * ─── BOTH SINGLE-RECORD BINDINGS, ONE IMPLEMENTATION ───────────────────────
 *
 * A page reaches one record two ways: `collection` (slug-matched) or a
 * page-level `dataSource: { table, mode: 'single', param }`. The convention is
 * the SAME for both — the comments schema calls `recordId` "auto-resolved to
 * $record.id by default" without naming a binding — so both arms call this.
 *
 * A failure here is silent: with no record id the renderer omits the
 * `data-island="comments"` marker entirely, so no fetch runs and the SSR empty
 * state stays on the page — exactly what a record with no comments looks like.
 *
 * A record with no readable `id` is left alone: an auto-bind onto `"undefined"`
 * would fetch a record that cannot exist and turn a silent empty thread into a
 * silent wrong one. Runs recursively so `comments` components nested inside
 * layout containers (eg. `section > comments`) also get the auto-bind.
 */
export function autoBindCommentComponents(
  components: Page['components'],
  table: string | undefined,
  record: Readonly<Record<string, unknown>>
): Page['components'] {
  const { id } = record
  if (!components || id === undefined || id === null) return components
  const binding: CommentBinding = { table, recordId: String(id), record }
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    return autoBindCommentInComponent(item as Component, binding)
  })
}

interface CommentBinding {
  readonly table: string | undefined
  readonly recordId: string
  readonly record: Readonly<Record<string, unknown>>
}

/** `value` with any `$record.*` reference filled from the page record. */
const resolvedReference = (value: unknown, record: CommentBinding['record']): unknown =>
  typeof value === 'string' && value.includes('$record.')
    ? substituteRecordVars(value, record)
    : value

/** A `comments` component addressed to the page record; any other component unchanged. */
function bindComment(component: Component, binding: CommentBinding): Component {
  if (component.type !== 'comments') return component
  const own = component as Component & { readonly recordId?: unknown }
  const props = component.props ?? {}
  const explicit = typeof props.recordId === 'string'
  return {
    ...component,
    ...(own.recordId !== undefined && {
      recordId: resolvedReference(own.recordId, binding.record),
    }),
    props: {
      ...props,
      ...(typeof props.table === 'string' || binding.table === undefined
        ? {}
        : { table: binding.table }),
      recordId: explicit ? resolvedReference(props.recordId, binding.record) : binding.recordId,
    },
  } as Component
}

function autoBindCommentInComponent(component: Component, binding: CommentBinding): Component {
  const bound = bindComment(component, binding)
  if (!bound.children || bound.children.length === 0) return bound
  return {
    ...bound,
    children: bound.children.map((child: Component | string) =>
      typeof child === 'string' ? child : autoBindCommentInComponent(child, binding)
    ),
  }
}
