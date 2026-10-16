/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A generic record sheet's Comments tab: the record's comment thread — the
 * very island a page's `comments` component mounts, with the thread props the
 * server resolved for the sheet's table and this record's id.
 *
 * Mounted as a nested island marker rather than imported: the thread is its
 * own island, fetched on demand, and the sheet hosts it the way it hosts the
 * islands of its composed children (`mountNestedIslands`), which also unmounts
 * it when the tab closes or the sheet moves to another record.
 */

import { useEffect, useRef, type ReactElement } from 'react'
import { mountNestedIslands } from './live-injected-markup'

/** The Comments tab's panel. */
export function CommentsPanel({
  table,
  recordId,
  thread,
  label,
}: {
  readonly table: string
  readonly recordId: string
  /** The thread island's props, as the server resolved them, less the record. */
  readonly thread: Readonly<Record<string, unknown>>
  /** The thread's accessible name. */
  readonly label: string
}): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const props = JSON.stringify({ ...thread, tableName: table, recordId })
  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined
    const host = document.createElement('section')
    host.setAttribute('data-island', 'comments')
    host.setAttribute('data-component-type', 'comments')
    host.setAttribute('aria-label', label)
    host.setAttribute('data-island-props', props)
    // A wrapper of its own per mount: the unmount `mountNestedIslands` hands
    // back runs later, and must reach only THIS thread — never one a re-render
    // has since mounted in its place.
    const wrapper = document.createElement('div')
    wrapper.append(host)
    root.replaceChildren(wrapper)
    const dispose = mountNestedIslands(wrapper)
    return () => {
      dispose()
      wrapper.remove()
    }
  }, [props, label])
  return (
    <div
      ref={containerRef}
      data-drawer-comments=""
    />
  )
}
