/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The behaviour of one sidebar drawer, wired onto its server-rendered frame.
 *
 * The frame (`render/registry/sidebar-drawer.tsx`) renders four things inside
 * the element carrying `data-sidebar-drawer`: this island's host, a disabled
 * menu button, an empty `<dialog>`, and the inline body holding the navigation.
 * These attribute names are spelled on both sides of the SSR boundary because
 * the render tree and the island tree may not import each other.
 *
 * ─── WHAT OPENING DOES ─────────────────────────────────────────────────────
 *
 * It lifts the body's children into the dialog and calls `showModal()`. The
 * platform then does the three things a hand-built overlay gets wrong: the page
 * behind turns inert, the dialog joins the top layer, and Escape closes it. What
 * the platform does NOT do is stop the page behind from scrolling under a wheel
 * or a key, so the document's overflow is held while the drawer is open.
 *
 * ─── WHAT CLOSING DOES, AND WHY IT IS IDEMPOTENT ───────────────────────────
 *
 * The drawer closes four ways — Escape, a tap on the backdrop, following any
 * entry, and the viewport widening past the breakpoint. Escape reaches us only
 * through the dialog's `close` event, which is queued as a TASK; the other three
 * close it ourselves. Following a same-page `#section` link must restore the
 * page's scroll BEFORE the browser scrolls to the section, so the restore runs
 * synchronously in our own close and again, as a no-op, when the event lands.
 * `aria-expanded` is the single record of "open", so no second flag can
 * disagree with the one a screen reader is told.
 */

const OVERFLOW_ATTRIBUTE = 'data-sidebar-drawer-overflow'

interface DrawerParts {
  readonly root: Element
  readonly trigger: HTMLButtonElement
  readonly panel: HTMLDialogElement
  readonly body: HTMLElement
}

/** The frame's parts, or `undefined` when the markup is not a drawer frame. */
const findParts = (root: Element): DrawerParts | undefined => {
  const panel = root.querySelector<HTMLDialogElement>(':scope > [data-sidebar-drawer-panel]')
  // A docs frame may lift its trigger into the page header; it still names the panel.
  const trigger =
    root.querySelector<HTMLButtonElement>(':scope > [data-sidebar-drawer-trigger]') ??
    document.querySelector<HTMLButtonElement>(
      `[data-sidebar-drawer-trigger][aria-controls="${panel?.id ?? ''}"]`
    )
  const body = root.querySelector<HTMLElement>(':scope > [data-sidebar-drawer-body]')
  if (trigger === null || panel === null || body === null) return undefined
  return { root, trigger, panel, body }
}

const isOpen = (parts: DrawerParts): boolean =>
  parts.trigger.getAttribute('aria-expanded') === 'true'

/**
 * Move every child of `from` to the end of `to`, in order.
 *
 * `moveBefore` keeps a moved node's state where `append` resets it: an `iframe`
 * or an embedded video an author placed in the sidebar would otherwise reload
 * on every open and close. It throws where a state-preserving move is not
 * possible, and older browsers lack it, so each node falls back to `append`.
 */
const moveChildren = (from: Element, to: Element): void => {
  Array.from(from.childNodes).forEach((node) => {
    try {
      to.moveBefore(node, null)
    } catch {
      to.append(node)
    }
  })
}

/** Hold the page still: no wheel, key or touch scrolls it while the drawer is open. */
const lockScroll = (root: Element): void => {
  const html = document.documentElement
  root.setAttribute(OVERFLOW_ATTRIBUTE, html.style.getPropertyValue('overflow'))
  html.style.setProperty('overflow', 'hidden')
  document.body.style.setProperty('overflow', 'hidden')
}

const unlockScroll = (root: Element): void => {
  const previous = root.getAttribute(OVERFLOW_ATTRIBUTE) ?? ''
  root.removeAttribute(OVERFLOW_ATTRIBUTE)
  if (previous === '') document.documentElement.style.removeProperty('overflow')
  else document.documentElement.style.setProperty('overflow', previous)
  document.body.style.removeProperty('overflow')
}

const open = (parts: DrawerParts): void => {
  if (isOpen(parts)) return
  moveChildren(parts.body, parts.panel)
  lockScroll(parts.root)
  parts.trigger.setAttribute('aria-expanded', 'true')
  parts.panel.showModal()
  // `showModal` focuses the first focusable descendant; a drawer holding none
  // (every group fetched and still loading) takes focus itself instead, so the
  // reader is never left on the inert page behind.
  if (!parts.panel.contains(document.activeElement)) parts.panel.focus()
}

/** Put the navigation back and the page as it was. A no-op when already closed. */
const restore = (parts: DrawerParts): void => {
  if (!isOpen(parts)) return
  moveChildren(parts.panel, parts.body)
  unlockScroll(parts.root)
  parts.trigger.setAttribute('aria-expanded', 'false')
  parts.trigger.focus({ preventScroll: true })
}

const close = (parts: DrawerParts): void => {
  if (parts.panel.open) parts.panel.close()
  restore(parts)
}

/** Is the pointer event outside the panel's own box — i.e. on the backdrop? */
const onBackdrop = (panel: HTMLDialogElement, event: MouseEvent): boolean => {
  if (event.target !== panel) return false
  const box = panel.getBoundingClientRect()
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
}

/**
 * Wire the drawer whose frame is `root`, and return the teardown.
 *
 * Any click on a link inside closes the drawer and lets the browser follow it:
 * nothing here navigates, so no DOM-sourced address ever reaches `location`.
 */
export const wireSidebarDrawer = (root: Element): (() => void) => {
  const parts = findParts(root)
  if (parts === undefined) return () => undefined

  const onTrigger = (): void => open(parts)
  const onPanelClick = (event: MouseEvent): void => {
    const { target } = event
    const followsLink = target instanceof Element && target.closest('a[href]') !== null
    if (followsLink || onBackdrop(parts.panel, event)) close(parts)
  }
  const onPanelClose = (): void => restore(parts)
  // A drawer left open while the viewport widens past its breakpoint would
  // hold the navigation away from the inline body that is now showing; the
  // trigger's own `display` IS the breakpoint, so no pixel value is duplicated.
  const onResize = (): void => {
    if (isOpen(parts) && getComputedStyle(parts.trigger).display === 'none') close(parts)
  }

  parts.trigger.addEventListener('click', onTrigger)
  parts.panel.addEventListener('click', onPanelClick)
  parts.panel.addEventListener('close', onPanelClose)
  window.addEventListener('resize', onResize)
  parts.trigger.removeAttribute('disabled')

  return () => {
    close(parts)
    parts.trigger.removeEventListener('click', onTrigger)
    parts.panel.removeEventListener('click', onPanelClick)
    parts.panel.removeEventListener('close', onPanelClose)
    window.removeEventListener('resize', onResize)
    parts.trigger.setAttribute('disabled', '')
  }
}
