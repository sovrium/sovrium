/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { exportNodeIdOf } from '@/domain/models/app/pages/node-identity'
import { cn } from '@/presentation/design/class-merge'
import { GripVerticalGlyph } from '@/presentation/design/control-glyphs'
import { InlineScript } from '@/presentation/design/inline-script'
import {
  computeItemClasses,
  computeItemContentClasses,
} from '@/presentation/design/item-default-classes'
import {
  computeReorderableHandleClasses,
  computeReorderableListClasses,
  computeReorderableRowClasses,
} from '@/presentation/design/reorderable-list-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import { REORDERABLE_LIST_RUNTIME } from './reorderable-list-runtime'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** The grip handle at the start of every row: a ghost icon button drawing a grip. */
function dragHandle(): ReactElement {
  return (
    <span
      data-drag-handle="true"
      data-slot="reorderable-list-handle"
      role="button"
      tabIndex={0}
      aria-label="Drag to reorder"
      aria-pressed="false"
      className={computeReorderableHandleClasses()}
    >
      <GripVerticalGlyph />
    </span>
  )
}

/** One row: an outlined small item, its handle at the start and its text in its content. */
const ROW_CLASSES = cn(computeItemClasses({ variant: 'outline' }), computeReorderableRowClasses())

/** Shape of a raw list-item child read off the component definition. */
interface RawListChild {
  readonly type?: string
  readonly content?: string
  readonly props?: { readonly id?: string }
}

/** Shape of the optional `onReorder` action read off the component definition. */
interface RawReorderAction {
  readonly type?: string
  readonly message?: string
  readonly variant?: string
  /**
   * The author's explicit auto-dismiss delay, per `ToastActionSchema`.
   *
   * Honoured: it is surfaced as `data-on-reorder-toast-duration` and resolved
   * against the shared policy in `inline-toast-policy-runtime.ts`, where an
   * explicit positive duration wins over every default.
   */
  readonly duration?: number
}

/**
 * Renderer for the `reorderable-list` component type.
 *
 * Renders a `<ul>` of `<li>` rows built directly from the component's raw
 * `children` definitions. Each row carries a `[data-drag-handle]` element
 * and the list ships an inline keyboard-reorder runtime so reordering works
 * without the React island bundle.
 *
 * Building `<li>` rows directly (rather than reusing the pre-rendered
 * `list-item` children) avoids invalid nested `<li>` markup — the `list-item`
 * renderer would otherwise emit its own `<li>` inside this list's `<li>`.
 *
 * When the component declares
 * `onReorder: { type: 'toast', message, variant?, duration? }`, all three are
 * surfaced as `data-on-reorder-toast-*` attributes on the `<ul>` so the inline
 * runtime can show the toast every time the user reorders a row — and resolve
 * how long it stays, since the runtime has no other channel to the config.
 */
export const reorderableListComponent: ComponentRenderer = ({ elementProps, component }) => {
  const rawChildren = ((component as { readonly children?: ReadonlyArray<unknown> } | undefined)
    ?.children ?? []) as ReadonlyArray<RawListChild>

  const items = rawChildren.map((child, index) => (
    <li
      key={`reorderable-item-${index}`}
      id={child.props?.id}
      // A page export's copy of the row's node: the row is the only element it gets.
      data-sovrium-id={exportNodeIdOf(child)}
      role="listitem"
      data-reorderable-item="true"
      data-slot="item"
      data-variant="outline"
      data-size="sm"
      className={ROW_CLASSES}
    >
      {dragHandle()}
      <div
        data-slot="item-content"
        className={computeItemContentClasses()}
      >
        {child.content}
      </div>
    </li>
  ))

  const onReorder = (component as { readonly onReorder?: RawReorderAction } | undefined)?.onReorder
  const toastAttrs: Record<string, string> =
    onReorder?.type === 'toast' && typeof onReorder.message === 'string'
      ? {
          'data-on-reorder-toast-message': onReorder.message,
          ...(onReorder.variant ? { 'data-on-reorder-toast-variant': onReorder.variant } : {}),
          ...(typeof onReorder.duration === 'number' && onReorder.duration > 0
            ? { 'data-on-reorder-toast-duration': String(onReorder.duration) }
            : {}),
        }
      : {}

  const authorClassName = elementProps['className'] as string | undefined
  const listPrestyle = computeReorderableListClasses()
  const listClassName = mergePrestyle(listPrestyle, authorClassName)

  return (
    <>
      <ul
        {...omitInternalMarkers(elementProps)}
        {...toastAttrs}
        data-reorderable-list="true"
        data-slot="reorderable-list"
        className={listClassName}
      >
        {items}
      </ul>
      <InlineScript source={REORDERABLE_LIST_RUNTIME} />
    </>
  )
}
