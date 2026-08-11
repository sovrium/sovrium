/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeReorderableHandleClasses,
  computeReorderableListClasses,
} from '@/presentation/ui/sections/renderers/element-renderers/recipes/specialty-ssr-default-classes'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * Keyboard reorder runtime for `reorderable-list` components.
 *
 * Server-authored constant string (no untrusted interpolation) dropped into
 * an inline `<script>` so the list supports keyboard reordering without
 * shipping the React island bundle. Mirrors the form-runtime inline-script
 * pattern.
 *
 * Interaction model:
 *  - Focus a `[data-drag-handle]` element, press Space to "pick up" the row.
 *  - ArrowUp / ArrowDown move the picked-up row within its list.
 *  - Space again drops the row (and re-focuses the handle).
 */
const REORDERABLE_LIST_RUNTIME = `(function () {
  function showToast(message, variant) {
    if (!message) return
    var container = document.querySelector('[data-sonner-toaster]')
    if (!container) {
      container = document.createElement('div')
      container.setAttribute('data-sonner-toaster', '')
      container.setAttribute('role', 'status')
      container.setAttribute('aria-live', 'polite')
      container.style.position = 'fixed'
      container.style.bottom = '16px'
      container.style.right = '16px'
      container.style.zIndex = '9999'
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '8px'
      document.body.appendChild(container)
    }
    var toast = document.createElement('div')
    toast.setAttribute('data-toast', '')
    if (variant) toast.setAttribute('data-variant', variant)
    toast.textContent = message
    container.appendChild(toast)
  }

  function handleReorder(list) {
    var message = list.getAttribute('data-on-reorder-toast-message')
    if (message) {
      var variant = list.getAttribute('data-on-reorder-toast-variant') || undefined
      showToast(message, variant)
    }
  }

  function setup(list) {
    if (list.getAttribute('data-reorderable-ready') === 'true') return
    list.setAttribute('data-reorderable-ready', 'true')
    var grabbedHandle = null

    function itemOf(handle) {
      var node = handle
      while (node && node !== list) {
        if (node.parentElement === list) return node
        node = node.parentElement
      }
      return null
    }

    function move(item, direction) {
      if (!item) return
      if (direction < 0) {
        var prev = item.previousElementSibling
        if (prev) list.insertBefore(item, prev)
      } else {
        var next = item.nextElementSibling
        if (next) list.insertBefore(next, item)
      }
    }

    list.addEventListener('keydown', function (event) {
      var handle = event.target
      if (!handle || !handle.hasAttribute || !handle.hasAttribute('data-drag-handle')) return
      var item = itemOf(handle)
      if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
        event.preventDefault()
        if (grabbedHandle === handle) {
          grabbedHandle = null
          handle.setAttribute('aria-pressed', 'false')
          if (item) item.removeAttribute('data-reorder-active')
        } else {
          grabbedHandle = handle
          handle.setAttribute('aria-pressed', 'true')
          if (item) item.setAttribute('data-reorder-active', 'true')
        }
        return
      }
      if (grabbedHandle !== handle) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        move(item, 1)
        handle.focus()
        list.dispatchEvent(new CustomEvent('reorder', { bubbles: false }))
        handleReorder(list)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        move(item, -1)
        handle.focus()
        list.dispatchEvent(new CustomEvent('reorder', { bubbles: false }))
        handleReorder(list)
      }
    })
  }

  function init() {
    var lists = document.querySelectorAll('[data-reorderable-list]')
    for (var i = 0; i < lists.length; i++) setup(lists[i])
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})();`

/** A `<span>` drag-handle prepended to every reorderable list item. */
function dragHandle(key: string): ReactElement {
  return (
    <span
      key={key}
      data-drag-handle="true"
      role="button"
      tabIndex={0}
      aria-label="Drag to reorder"
      aria-pressed="false"
      className={computeReorderableHandleClasses()}
    >
      {'☰'}
    </span>
  )
}

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
 * When the component declares `onReorder: { type: 'toast', message, variant? }`,
 * the toast message and variant are surfaced as `data-on-reorder-toast-*`
 * attributes on the `<ul>` so the inline runtime can show the toast every
 * time the user reorders a row via keyboard.
 */
export const reorderableListComponent: ComponentRenderer = ({ elementProps, component }) => {
  const rawChildren = ((component as { readonly children?: ReadonlyArray<unknown> } | undefined)
    ?.children ?? []) as ReadonlyArray<RawListChild>

  const items = rawChildren.map((child, index) => (
    <li
      key={`reorderable-item-${index}`}
      id={child.props?.id}
      role="listitem"
      data-reorderable-item="true"
    >
      {dragHandle(`handle-${index}`)}
      {child.content}
    </li>
  ))

  const onReorder = (component as { readonly onReorder?: RawReorderAction } | undefined)?.onReorder
  const toastAttrs: Record<string, string> =
    onReorder?.type === 'toast' && typeof onReorder.message === 'string'
      ? {
          'data-on-reorder-toast-message': onReorder.message,
          ...(onReorder.variant ? { 'data-on-reorder-toast-variant': onReorder.variant } : {}),
        }
      : {}

  const authorClassName = elementProps['className'] as string | undefined
  const listPrestyle = computeReorderableListClasses()
  const listClassName = authorClassName ? `${listPrestyle} ${authorClassName}` : listPrestyle

  return (
    <>
      <ul
        {...elementProps}
        {...toastAttrs}
        data-reorderable-list="true"
        className={listClassName}
      >
        {items}
      </ul>
      <script
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR runtime emission
        dangerouslySetInnerHTML={{ __html: REORDERABLE_LIST_RUNTIME }}
      />
    </>
  )
}
