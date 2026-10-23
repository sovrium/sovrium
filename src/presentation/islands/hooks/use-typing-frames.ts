/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'

/**
 * The DOM event the page's app connection raises for each `typing` frame of
 * the record it follows: someone else started or stopped writing there.
 */
export const TYPING_FRAME_EVENT = 'sovrium:typing-frame'

/** How long a typing frame stays fresh: the server re-sends one at most every two seconds. */
const TYPING_FRESH_MS = 5000

interface TypingFrame {
  readonly userId?: unknown
  readonly name?: unknown
  readonly typing?: unknown
}

type Typers = ReadonlyMap<string, { readonly name: string; readonly at: number }>

/** The typing frames the page's app connection received before the frame was drawn, by person. */
interface TypingLedger {
  readonly sovriumTyping?: Readonly<
    Record<string, { readonly frame?: TypingFrame; readonly at?: number }>
  >
}

/** Who was already typing when the frame was drawn, from the app connection's ledger. */
const typingBeforeMount = (): Typers =>
  new Map(
    Object.entries((window as TypingLedger).sovriumTyping ?? {}).flatMap(([userId, entry]) => {
      const { frame, at = 0 } = entry
      const name = frame?.name
      const fresh = Date.now() - at < TYPING_FRESH_MS && frame?.typing === true
      return fresh && typeof name === 'string' && name.trim() !== ''
        ? [[userId, { name, at }] as const]
        : []
    })
  )

/** The typers after one frame: a fresh entry for one who types, none for one who stopped. */
const afterFrame = (typers: Typers, frame: TypingFrame): Typers => {
  const { userId, name, typing } = frame
  if (typeof userId !== 'string') return typers
  const others = new Map([...typers].filter(([id]) => id !== userId))
  return typing === true && typeof name === 'string' && name.trim() !== ''
    ? new Map([...others, [userId, { name, at: Date.now() }]])
    : others
}

/**
 * The names of the people writing in the followed conversation right now, in
 * the order they started: each from the name its frame carries, kept while
 * its frames stay fresh, dropped when the person stops or sends. Nothing when
 * `enabled` is off.
 */
export function useTypingNames(enabled: boolean): readonly string[] {
  const [typers, setTypers] = useState<Typers>(new Map())
  useEffect(() => {
    if (!enabled) return undefined
    setTypers(typingBeforeMount())
    const onFrame = (event: Event): void => {
      setTypers((current) => afterFrame(current, (event as CustomEvent<TypingFrame>).detail ?? {}))
    }
    const expire = window.setInterval(() => {
      setTypers((current) => {
        const fresh = [...current].filter(([, typer]) => Date.now() - typer.at < TYPING_FRESH_MS)
        return fresh.length === current.size ? current : new Map(fresh)
      })
    }, 1000)
    document.addEventListener(TYPING_FRAME_EVENT, onFrame)
    return () => {
      window.clearInterval(expire)
      document.removeEventListener(TYPING_FRAME_EVENT, onFrame)
    }
  }, [enabled])
  return [...typers.values()].map((typer) => typer.name)
}
