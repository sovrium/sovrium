/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMarkRead, type MarkReadTarget } from './hooks/use-mark-read'
import { joinFeed, useLiveRefresh, type LiveRefreshSource } from './hooks/use-realtime-subscription'
import { useTypingNames } from './hooks/use-typing-frames'
import type { ReactElement } from 'react'

interface MessageScrollerIslandProps {
  readonly position?: 'start' | 'end' | 'last-anchor'
  readonly autoScroll?: boolean
  readonly anchorPeek?: number
  /** A bound frame's binding: the table its turns are read from, and how they follow it. */
  readonly source?: LiveRefreshSource
  /** The parent a signed-in reader's frame marks read, and the position it was drawn from. */
  readonly readState?: MarkReadTarget & { readonly since?: string }
  /** "{name} is typing", in the page language, on a frame following who types in it. */
  readonly typingLabel?: string
}

/** How close to the end, in pixels, still counts as "at the end" for following new turns. */
const AT_END_SLACK = 24

/** The node this island is mounted in: kept through every redraw of the frame. */
const ISLAND_HOST = '[data-island="message-scroller"]'

/** A turn a composer drew before the server answered: kept until the composer settles it. */
const PENDING_TURN = '[data-composer-pending]'

/** A turn a composer drew and the server then stored: the stored record replaces it. */
const SENT_TURN = '[data-composer-sent]'

/** Where the frame's scroll opens, in pixels from the top. */
function openingScrollTop(frame: HTMLElement, position: string, anchorPeek: number): number {
  if (position === 'start') return 0
  const turns = frame.querySelectorAll<HTMLElement>('[data-slot="message"]')
  const last = turns.item(turns.length - 1)
  if (position === 'last-anchor' && last !== null) {
    return Math.max(last.offsetTop - frame.offsetTop - anchorPeek, 0)
  }
  return frame.scrollHeight
}

/** The same frame in a freshly served copy of the page: by its id, else by its place. */
function frameIn(doc: Document, frame: HTMLElement): Element | undefined {
  if (frame.id !== '') return doc.getElementById(frame.id) ?? undefined
  const frames = Array.from(document.querySelectorAll('[data-slot="message-scroller"]'))
  return doc.querySelectorAll('[data-slot="message-scroller"]')[frames.indexOf(frame)]
}

/**
 * Draw the frame's turns again from the server: the page is read once more —
 * the same render, under the same read gate, as the first load — and the
 * frame's children are swapped in one mutation, so a reader at the end follows
 * the new turns and one scrolled up keeps her place. The island's own host and
 * any turn a composer is still sending are kept.
 */
async function redrawFrame(frame: HTMLElement, opened: string | undefined): Promise<void> {
  const response = await fetch(window.location.href, {
    headers: {
      'X-Sovrium-Partial': 'content',
      Accept: 'text/html',
      // The position the page opened with, so the New marker stays while she reads.
      ...(opened === undefined ? {} : { 'X-Sovrium-Read-Since': encodeURIComponent(opened) }),
    },
    credentials: 'same-origin',
  })
  if (!response.ok) return
  const served = frameIn(new DOMParser().parseFromString(await response.text(), 'text/html'), frame)
  if (served === undefined || !frame.isConnected) return
  // Nothing changed: the frame — and a sheet open in it — stays as it is, but
  // for a sent turn, whose stored record an earlier redraw (one the change
  // feed asked for while the turn was still pending) has already drawn.
  const digest = 'data-conversation-digest'
  if (served.getAttribute(digest) === frame.getAttribute(digest)) {
    frame.querySelectorAll(`:scope > ${SENT_TURN}`).forEach((turn) => turn.remove())
    return
  }
  // A sheet is open in the frame: redrawing would close it under the reader.
  if (frame.querySelector('dialog[open]') !== null) return
  const servedDigest = served.getAttribute(digest)
  if (servedDigest !== null) frame.setAttribute(digest, servedDigest)
  const host = frame.querySelector(`:scope > ${ISLAND_HOST}`)
  const pending = Array.from(frame.querySelectorAll(`:scope > ${PENDING_TURN}`))
  const turns = Array.from(served.childNodes).filter(
    (node) => !(node instanceof Element && node.matches(ISLAND_HOST))
  )
  const client = await import('./island-client')
  Array.from(frame.children)
    .filter((child) => child !== host && !pending.includes(child))
    .forEach((child) => client.unmountIslandsWithin(child))
  frame.replaceChildren(...turns, ...pending, ...(host === null ? [] : [host]))
  client.mountIslandsWithin(frame)
}

/** What a redraw sends back: the parent, and the read position the page opened with. */
const openedPositionOf = (readState: MessageScrollerIslandProps['readState']) =>
  readState?.since === undefined ? undefined : JSON.stringify(readState)

/** Redraw a frame on demand, one read at a time: a call during a read asks for one more after it. */
function useFrameRedraw(
  anchor: React.RefObject<HTMLSpanElement | null>,
  opened: string | undefined
): () => void {
  const state = useRef({ running: false, again: false })
  return useCallback(() => {
    const frame = anchor.current?.closest<HTMLElement>('[data-slot="message-scroller"]')
    if (!frame) return
    if (state.current.running) {
      state.current.again = true
      return
    }
    state.current.running = true
    const run = (): void => {
      state.current.again = false
      void redrawFrame(frame, opened)
        .catch(() => undefined)
        .finally(() => {
          if (state.current.again) run()
          else state.current.running = false
        })
    }
    run()
  }, [anchor, opened])
}

/** Draw the frame again whenever a form on the page writes to its table. */
function useRedrawOnWrite(table: string | undefined, redraw: () => void): void {
  useEffect(() => {
    if (table === undefined) return undefined
    const onWrite = (event: Event): void => {
      if ((event as CustomEvent<{ table?: string }>).detail?.table === table) redraw()
    }
    document.addEventListener('sovrium:crud-success', onWrite)
    return () => document.removeEventListener('sovrium:crud-success', onWrite)
  }, [table, redraw])
}

/**
 * Who is writing in a followed conversation, one line each below its turns.
 * The island's host is hidden but while someone is.
 */
function TypingLines({
  label,
  anchor,
}: {
  readonly label: string | undefined
  readonly anchor: React.RefObject<HTMLSpanElement | null>
}): ReactElement {
  const typing = useTypingNames(label !== undefined)
  useEffect(() => {
    const host = anchor.current?.parentElement
    if (host) host.hidden = typing.length === 0
  }, [anchor, typing.length])
  return (
    <>
      {typing.map((name) => (
        <span
          key={name}
          data-slot="message-scroller-typing"
          className="text-muted-foreground block px-2 py-1 text-xs"
        >
          {(label ?? '').replace('{name}', name)}
        </span>
      ))}
    </>
  )
}

/**
 * The `message-scroller` behaviour: an ENHANCEMENT island that renders only an
 * inert anchor inside the server-drawn frame. It opens the frame where the
 * config says — at the latest turn by default — and, with `autoScroll`, keeps
 * the reader at the end as turns are added, unless they had scrolled up. A
 * frame bound to a table draws its turns again when the table changes, as its
 * `dataSource.refreshMode` asks, and whenever a form on the page writes to it.
 */
export default function MessageScrollerIsland({
  position = 'end',
  autoScroll = false,
  anchorPeek = 64,
  source,
  readState,
  typingLabel,
}: MessageScrollerIslandProps): ReactElement {
  const anchor = useRef<HTMLSpanElement>(null)
  const redraw = useFrameRedraw(anchor, openedPositionOf(readState))
  useMarkRead(readState, anchor)
  useLiveRefresh(source, redraw)
  const table = source?.table
  // The server buffers no change: one written between the page being drawn and
  // the feed opening would never arrive, so the frame is drawn once more as
  // soon as the feed is live.
  const live = source?.refreshMode === 'realtime' ? table : undefined
  useEffect(() => {
    if (live === undefined) return undefined
    const state = { caughtUp: false }
    return joinFeed(live, (frame) => {
      if (frame !== 'connected' || state.caughtUp) return
      state.caughtUp = true
      redraw()
    })
  }, [live, redraw])
  useRedrawOnWrite(table, redraw)
  useEffect(() => {
    const frame = anchor.current?.closest<HTMLElement>('[data-slot="message-scroller"]')
    if (!frame) return undefined
    frame.scrollTo({ top: openingScrollTop(frame, position, anchorPeek) })
    if (!autoScroll) return undefined
    const atEnd = { current: true }
    const onScroll = (): void => {
      atEnd.current = frame.scrollHeight - frame.clientHeight - frame.scrollTop < AT_END_SLACK
    }
    const follow = new MutationObserver(() => {
      if (atEnd.current) frame.scrollTo({ top: frame.scrollHeight })
    })
    frame.addEventListener('scroll', onScroll, { passive: true })
    follow.observe(frame, { childList: true })
    return () => {
      frame.removeEventListener('scroll', onScroll)
      follow.disconnect()
    }
  }, [position, autoScroll, anchorPeek])
  return (
    <>
      <span
        ref={anchor}
        hidden
      />
      <TypingLines
        label={typingLabel}
        anchor={anchor}
      />
    </>
  )
}
