/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * WHEN an island mounts: when it can be seen or used, not when it is found.
 *
 * Mounting every marker on discovery made a page fetch and run the code of a
 * chart nobody scrolled to and of a chat nobody opened. The mounter now asks
 * {@link heldBack} first, handing it the callback that mounts the host later.
 *
 * Only two families wait, and neither is inferred:
 *
 * - Display islands whose host the server marked `data-island-drawn`: it
 *   drew what their reader would read in them (a KPI's figure, a table's or a
 *   list's rows), so find-in-page and a print reach it before any code runs.
 *   One far from the viewport mounts when it comes within {@link NEAR_PX} of
 *   it. An island with nothing readable drawn never waits: it mounts at once,
 *   as does every other island — a dialog, a drawer or a form can be opened or
 *   filled by an event sent from elsewhere on the page, and a listener that is
 *   not mounted hears nothing.
 * - {@link UNTIL_USED}: the AI chat, wherever it sits, while it has nothing of
 *   its own to show. It mounts on the first hover, focus, press, key or input
 *   inside its panel; the mounter's own focus capture hands the caret back to
 *   the composer the reader chose. A chat that replays its history
 *   (`showHistory`) or opens with words from the address (`draftParam`) shows
 *   something the server did not draw, so it mounts as a display island does.
 *
 * A press or an Enter that lands in a host woken by use, before its island is
 * live, is held and replayed once on the live markup ({@link keepFirstAction}):
 * the reader's first click on a suggestion is what woke the chat, and the
 * server-drawn chip it landed on has nothing behind it.
 *
 * A print takes the whole page, whatever the reader reached, so `beforeprint`
 * wakes every waiting host ({@link wakeAll}).
 * A browser cannot be made to hold its print for a read: what a data island
 * fetches lands on the page, and in a print started once it has arrived.
 *
 * A host waits for nothing when the reader is already in it: it holds the
 * focus, or a field in it differs from what the server wrote. Its server-drawn
 * markup stays in place while it waits, so nothing moves when it mounts.
 *
 * A closed `tabs` panel needs no rule here: its markup is a prop of the tabs
 * island and reaches the page only when the panel opens.
 */

import { whenIslandReady } from './pre-mount-input'

/** Islands that may wait until the reader uses them. */
const UNTIL_USED = new Set(['ai-chat'])

/** How close to the viewport, in CSS pixels, a waiting display island mounts. */
const NEAR_PX = 256

/** Each waiting host, and what mounts it. */
const waiting = new Map<HTMLElement, () => void>()

/** One observer for every host waiting to be seen, built on the first. */
let observer: IntersectionObserver | undefined

/** Whether the reader has already started using `el`: its focus, or an edited field. */
function inUse(el: HTMLElement): boolean {
  if (el.contains(document.activeElement)) return true
  return Array.from(el.querySelectorAll('input, textarea')).some((field) => {
    const input = field as HTMLInputElement
    return input.value !== input.defaultValue || input.checked !== input.defaultChecked
  })
}

/** Whether a chat's island props ask it to replay its history; unreadable props do not. */
function showsHistory(raw: string | undefined): boolean {
  try {
    return (JSON.parse(raw ?? '{}') as { showHistory?: unknown }).showHistory === true
  } catch {
    return false
  }
}

/** Whether a chat has nothing to show until it is used: no history, no words from the address. */
function quietChat(el: HTMLElement): boolean {
  if (showsHistory(el.dataset.islandProps)) return false
  const draft = el.querySelector<HTMLElement>('[data-draft-param]')?.dataset.draftParam
  return !(draft && new URLSearchParams(location.search).has(draft))
}

/** Whether `el` lies within {@link NEAR_PX} of the viewport, or has no box to place. */
function nearViewport(el: HTMLElement): boolean {
  const box = el.getBoundingClientRect()
  if (box.width === 0 && box.height === 0) return true
  return box.top < window.innerHeight + NEAR_PX && box.bottom > -NEAR_PX
}

/** Whether `el` sits inside a host that is waiting. */
function insideWaitingHost(el: HTMLElement): boolean {
  const outer = el.parentElement?.closest<HTMLElement>('[data-island]')
  return outer ? waiting.has(outer) || insideWaitingHost(outer) : false
}

/** What the host of an island of `type` waits for: to be `seen`, to be `used`, or nothing. */
export function waitFor(el: HTMLElement, type: string): 'seen' | 'used' | undefined {
  if (inUse(el)) return undefined
  if (UNTIL_USED.has(type) && quietChat(el)) return 'used'
  return ('islandDrawn' in el.dataset || UNTIL_USED.has(type)) && !nearViewport(el)
    ? 'seen'
    : undefined
}

/** Stop waiting on `el`, and run its mount if it is still in the page. */
function wake(el: HTMLElement): void {
  const mount = waiting.get(el)
  if (!mount) return
  cancelDeferredMount(el)
  if (el.isConnected) mount()
}

/** Wake every waiting host: a print is about to take the whole page. */
const wakeAll = (): void => Array.from(waiting.keys()).forEach((el) => wake(el))

/** The waiting host an event landed in, if any. */
function waitingHostOf(target: EventTarget | null): HTMLElement | undefined {
  const start = target instanceof Element ? target : undefined
  const host = start?.closest<HTMLElement>('[data-island]')
  if (!host) return undefined
  return waiting.has(host) ? host : waitingHostOf(host.parentElement)
}

/** Whether a live element of `host` stands where `held` stood: same tag, test id and text. */
const sameControl = (held: Element, live: Element): boolean =>
  live.tagName === held.tagName &&
  live.getAttribute('data-testid') === held.getAttribute('data-testid') &&
  live.textContent === held.textContent

/** How long a held action waits for its island before it is let through as it was. */
const HOLD_MS = 8000

/**
 * Hold the first press of a button, or the first Enter in a field, that lands
 * in `host` while its island is not live yet, and replay it exactly once on
 * the matching element: the live one when the island is ready, or, if it is
 * not ready within {@link HOLD_MS} (its code failed or is stuck), the
 * server-drawn one, natively, so a reader's action is never swallowed. The
 * held event is stopped, so nothing acts on it twice; a host already live is
 * left alone. Returns the holder, so the event that woke the host, which
 * listeners added during its own dispatch never see, can be offered too.
 */
function keepFirstAction(host: HTMLElement): (event: Event) => void {
  const types = ['click', 'keydown']
  const stop = (): void => types.forEach((type) => document.removeEventListener(type, hold, true))
  function hold(event: Event): void {
    const target = event.target instanceof Element ? event.target : null
    const enter = event instanceof KeyboardEvent && event.key === 'Enter' && !event.shiftKey
    const held =
      event.type === 'click' ? target?.closest('button, [role="button"]') : enter && target
    if (!held || !host.contains(held) || host.dataset.islandReady) return
    event.preventDefault()
    event.stopPropagation()
    stop()
    let done = false
    const replay = (): void => {
      if (done) return
      done = true
      const live = Array.from(host.querySelectorAll(held.tagName)).find((el) =>
        sameControl(held, el)
      )
      if (!(live instanceof HTMLElement)) return
      if (!enter) live.click()
      else if (host.dataset.islandReady) {
        live.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      } else if (live instanceof HTMLInputElement) live.form?.requestSubmit()
    }
    whenIslandReady(host, replay)
    setTimeout(replay, HOLD_MS)
  }
  types.forEach((type) => document.addEventListener(type, hold, true))
  whenIslandReady(host, stop)
  setTimeout(stop, HOLD_MS)
  return hold
}

/** Use, anywhere on the page, wakes the waiting host it lands in. */
const onUse = (event: Event): void => {
  const host = waitingHostOf(event.target)
  if (!host) return
  keepFirstAction(host)(event)
  wake(host)
}

/** Listen for use and for a print on the page, and build the observer, once. */
function ensureWatching(): IntersectionObserver {
  if (observer) return observer
  ;['pointerover', 'focusin', 'pointerdown', 'keydown', 'input'].forEach((type) =>
    document.addEventListener(type, onUse, true)
  )
  window.addEventListener('beforeprint', wakeAll)
  observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) wake(entry.target as HTMLElement)
      }),
    { rootMargin: `${NEAR_PX}px 0px` }
  )
  return observer
}

/**
 * Whether the host `el` of an island of `type` is held back, to be mounted by
 * `mount` once it is seen or used. A host waiting to be seen also wakes on use,
 * and waking is once: `mount` runs at most one time, and never for a host that
 * has left the page. A marker inside a waiting host is held too, and never
 * mounted from here: the outer mount discards its markup, as it always has.
 */
export function heldBack(el: HTMLElement, type: string, mount: () => void): boolean {
  if (insideWaitingHost(el)) return true
  const until = waitFor(el, type)
  if (!until) return false
  const watcher = ensureWatching()
  waiting.set(el, mount)
  if (until === 'seen') watcher.observe(el)
  return true
}

/** Forget a waiting host — it is being unmounted or swapped out of the page. */
export function cancelDeferredMount(el: HTMLElement): void {
  if (!waiting.delete(el)) return
  observer?.unobserve(el)
}
