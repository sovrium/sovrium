/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

const REORDERABLE_LIST_RUNTIME = `(function () {
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
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        move(item, -1)
        handle.focus()
        list.dispatchEvent(new CustomEvent('reorder', { bubbles: false }))
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

function dragHandle(key: string): ReactElement {
  return (
    <span
      key={key}
      data-drag-handle="true"
      role="button"
      tabIndex={0}
      aria-label="Drag to reorder"
      aria-pressed="false"
      style={{ cursor: 'grab', marginRight: '0.5rem', userSelect: 'none' }}
    >
      {'☰'}
    </span>
  )
}

interface RawListChild {
  readonly type?: string
  readonly content?: string
  readonly props?: { readonly id?: string }
}

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

  return (
    <>
      <ul
        {...elementProps}
        data-reorderable-list="true"
      >
        {items}
      </ul>
      <script
        dangerouslySetInnerHTML={{ __html: REORDERABLE_LIST_RUNTIME }}
      />
    </>
  )
}
