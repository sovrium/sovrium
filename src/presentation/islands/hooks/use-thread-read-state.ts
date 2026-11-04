/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import { settledReadState } from '@/domain/models/app/pages/read-state-gate-service'
import { useReadState } from './use-read-state'

/**
 * Announce what a `message-scroller` frame holds to the buttons that follow it
 * by its `props.id` (`hiddenWhenRead`, `disabledWhenRead`). Its messages are
 * the server's, so it has read once it is drawn: `empty` or `nonEmpty`, and
 * again each time its messages are redrawn. Silent for a frame with no id.
 */
export function useThreadReadState(anchor: React.RefObject<HTMLElement | null>): void {
  const [thread, setThread] = useState<{ readonly id?: string; readonly turns?: number }>({})
  useEffect(() => {
    const frame = anchor.current?.closest<HTMLElement>('[data-slot="message-scroller"]')
    if (!frame || frame.id === '') return undefined
    const count = (): void =>
      setThread({ id: frame.id, turns: frame.querySelectorAll('[data-slot="message"]').length })
    count()
    const watch = new MutationObserver(count)
    watch.observe(frame, { childList: true })
    return () => watch.disconnect()
  }, [anchor])
  useReadState(undefined, settledReadState(false, thread.turns), thread.id)
}
