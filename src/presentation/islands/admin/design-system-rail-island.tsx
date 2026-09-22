/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The "On this page" scroll-spy.
 *
 * ─── WHAT IT REPLACED, AND WHY IT IS SO MUCH SMALLER ───────────────────────
 *
 * Until 2026-09-02 a rail entry could not simply be followed: its target lived
 * inside an `<iframe>`, where the parent document had no element with that id,
 * so a plain click wrote the fragment into the URL and scrolled nothing. Two
 * islands and a `postMessage` channel existed to close that gap — one to
 * intercept the click and forward it, one inside the frame to receive it, scroll
 * and report back both the reading position AND the document height.
 *
 * The frames are gone. The anchors now address ids in their own document, so
 * the BROWSER does the scrolling, the fragment survives being copied, and the
 * whole channel is deleted rather than disabled. What no amount of correct
 * scrolling provides is the marker saying which section is being read — a rail
 * that scrolls but never reflects position is a table of contents, not a rail —
 * and that is the entirety of what is left here.
 *
 * A pure enhancer: it renders nothing and wires behaviour onto server-rendered
 * markup, so the rail works with JavaScript off and only loses its highlight.
 */

import { useEffect } from 'react'

/** Every rail entry on the page, in reading order. */
const railEntries = (): readonly HTMLAnchorElement[] => [
  ...document.querySelectorAll<HTMLAnchorElement>('[data-design-rail-entry]'),
]

/** Every anchored region of the page, in reading order. */
const sections = (): readonly HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('[data-design-section]'),
]

/**
 * Mark exactly one entry as the one being read.
 *
 * Every entry is cleared before one is set, so the "exactly one" invariant
 * holds after any sequence of scrolls and clicks rather than only after the
 * first. A rail that marks two is worse than one that marks none.
 */
const markActive = (id: string | undefined): void => {
  railEntries().forEach((entry) => {
    const current = id !== undefined && entry.getAttribute('data-design-rail-entry') === id
    if (current) entry.setAttribute('aria-current', 'true')
    else entry.removeAttribute('aria-current')
  })
}

/**
 * The section a reader is currently on: the last one whose top has passed the
 * reading line.
 *
 * A generous 120px line rather than 0, because a section whose heading is one
 * pixel above the fold is the one being read, and a strict test flickers
 * between neighbours on every scroll frame.
 */
const activeSection = (): string | undefined => {
  const all = sections()
  const passed = all.filter((element) => element.getBoundingClientRect().top <= 120)
  return (passed.at(-1) ?? all[0])?.getAttribute('data-design-section') ?? undefined
}

export default function DesignSystemRailIsland(): null {
  useEffect(() => {
    const spy = (): void => markActive(activeSection())

    // Marked on the click as well as on the scroll it causes. The scroll
    // handler alone would be correct but not PROMPT: a fragment jump inside a
    // scroll container does not always emit a `scroll` event the same frame,
    // and an entry that highlights a beat after it is followed reads as a
    // click that did not register.
    const onClick = (event: MouseEvent): void => {
      const id = (event.target as HTMLElement | null)
        ?.closest<HTMLAnchorElement>('[data-design-rail-entry]')
        ?.getAttribute('data-design-rail-entry')
      if (id === null || id === undefined) return
      markActive(id)
    }

    // The rail lives inside the admin shell's own scrolling column, not the
    // window, so both are listened to: `scroll` does not bubble, and which of
    // the two actually moves is the shell's business rather than this island's.
    const column = document.getElementById('admin-surface-content')
    document.addEventListener('click', onClick)
    window.addEventListener('scroll', spy, { passive: true })
    column?.addEventListener('scroll', spy, { passive: true })
    spy()

    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('scroll', spy)
      column?.removeEventListener('scroll', spy)
    }
  }, [])

  // eslint-disable-next-line unicorn/no-null -- React renders nothing for null, not for undefined
  return null
}
