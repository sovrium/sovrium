/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { REORDERABLE_READY_MARK } from '@/presentation/design/runtime-ready-marks'
import { INLINE_TOAST_POLICY_RUNTIME } from './inline-toast-policy-runtime'

/**
 * Reorder runtime for `reorderable-list` components — keyboard AND pointer.
 *
 * Server-authored constant string (no untrusted interpolation) dropped into
 * an inline `<script>` so the list supports reordering without shipping the
 * React island bundle. Mirrors the form-runtime inline-script pattern.
 *
 * Interaction model:
 *  - Focus a `[data-drag-handle]` element, press Space to "pick up" the row.
 *  - ArrowUp / ArrowDown move the picked-up row within its list.
 *  - Space again drops the row (and re-focuses the handle).
 *  - OR: press the handle, move, release. Same reorder, same `reorder` event,
 *    same toast.
 *
 * ─── WHY THE POINTER PATH IS NOT @dnd-kit ─────────────────────────────────
 *
 * Every other draggable surface in this codebase is a React island and uses
 * `@dnd-kit`. This one is not an island at all, deliberately: the whole reason
 * the reorder lives in an inline script is that a list of three rows should not
 * cost a hydrated bundle. Reaching for `@dnd-kit` here would mean making it one,
 * which trades ~40 lines of DOM for a client chunk on every page that draws a
 * list — the opposite of what this component was built to avoid. The gesture it
 * needs is the simplest one dnd-kit implements.
 *
 * ─── WHY THE HANDLE INVITED SOMETHING IT COULD NOT ANSWER ─────────────────
 *
 * The handle has always been styled `cursor-grab` / `active:cursor-grabbing`
 * and labelled `Drag to reorder`, and keyboard was the only channel that
 * answered. Two readers were told to drag and could not: anyone using a mouse,
 * and anyone using touch.
 *
 * ─── WHAT IT DOES NOT DO ──────────────────────────────────────────────────
 *
 * It does not persist. The reorder is a DOM move inside the reader's own
 * document; nothing is requested and nothing survives a reload, in both
 * channels equally.
 *
 * The 8px threshold is `@dnd-kit`'s own `activationConstraint.distance`
 * default-by-convention, and it is what keeps a CLICK on the handle from
 * reading as a zero-length drag — which would fire a `reorder` event, and its
 * toast, for a gesture that moved nothing.
 */
export const REORDERABLE_LIST_RUNTIME = `(function () {
  // \`showToast\` and the helpers it uses are spliced in from
  // \`inline-toast-policy-runtime.ts\`, the one transcription of the dismissal
  // policy the two inline runtimes share. \`onReorder\` is a
  // \`ToastActionSchema\`, so a declared \`variant\` and \`duration\` both reach it.
${INLINE_TOAST_POLICY_RUNTIME}

  function handleReorder(list) {
    var message = list.getAttribute('data-on-reorder-toast-message')
    if (message) {
      var variant = list.getAttribute('data-on-reorder-toast-variant') || undefined
      // The attribute arrives as a string. An absent or unparseable one falls
      // through to the policy's own default rather than arming a NaN timer.
      var declared = parseInt(list.getAttribute('data-on-reorder-toast-duration'), 10)
      var duration = isNaN(declared) ? undefined : declared
      showToast(message, variant, duration)
    }
  }

  function setup(list) {
    if (list.getAttribute('${REORDERABLE_READY_MARK}') === 'true') return
    list.setAttribute('${REORDERABLE_READY_MARK}', 'true')
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
        announceReorder()
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        move(item, -1)
        handle.focus()
        announceReorder()
      }
    })

    function announceReorder() {
      list.dispatchEvent(new CustomEvent('reorder', { bubbles: false }))
      handleReorder(list)
    }

    /** The handle the event started on, or null when it started elsewhere. */
    function handleFrom(target) {
      var node = target
      while (node && node !== list) {
        if (node.hasAttribute && node.hasAttribute('data-drag-handle')) return node
        node = node.parentElement
      }
      return null
    }

    /** The row the dragged item should sit BEFORE, or null for the end. */
    function dropBefore(item, clientY) {
      var children = list.children
      for (var i = 0; i < children.length; i++) {
        var sibling = children[i]
        if (sibling === item) continue
        var rect = sibling.getBoundingClientRect()
        if (clientY < rect.top + rect.height / 2) return sibling
      }
      return null
    }

    var drag = null

    list.addEventListener('pointerdown', function (event) {
      var handle = handleFrom(event.target)
      if (!handle) return
      var item = itemOf(handle)
      if (!item) return
      // A pointer press ends any keyboard pick-up: two state machines holding
      // the same row at once is how a drop lands somewhere nobody aimed at.
      if (grabbedHandle) {
        grabbedHandle.setAttribute('aria-pressed', 'false')
        var held = itemOf(grabbedHandle)
        if (held) held.removeAttribute('data-reorder-active')
        grabbedHandle = null
      }
      // Suppress the browser's own text selection and native image drag, both
      // of which start on a press and both of which fight the reorder.
      event.preventDefault()
      drag = { item: item, startY: event.clientY, moved: false, changed: false }
    })

    document.addEventListener('pointermove', function (event) {
      if (!drag) return
      if (!drag.moved) {
        if (Math.abs(event.clientY - drag.startY) < 8) return
        drag.moved = true
        drag.item.setAttribute('data-reorder-active', 'true')
      }
      var before = dropBefore(drag.item, event.clientY)
      // Re-inserting a row where it already is would move a live DOM node for
      // nothing, on every one of the dozens of moves a drag emits.
      if (before) {
        if (drag.item.nextElementSibling === before) return
        list.insertBefore(drag.item, before)
      } else {
        if (list.lastElementChild === drag.item) return
        list.appendChild(drag.item)
      }
      drag.changed = true
    })

    document.addEventListener('pointerup', function () {
      if (!drag) return
      var changed = drag.changed
      drag.item.removeAttribute('data-reorder-active')
      drag = null
      if (changed) announceReorder()
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
