/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useGridString } from '../grid-strings'

/**
 * A polite live region saying how many records the grid now shows, once a
 * control on the page has narrowed it — so a screen-reader user hears that
 * picking a filter did something without leaving the control. On a grid that
 * listens to a channel the region is always in the DOM, empty until there is
 * something to say, because a live region added together with its text is not
 * announced. It carries no `status` role: the grid's own status lines (a
 * no-match message, a feed's loaded count) keep that name to themselves.
 */
export function ResultCountAnnouncer(props: {
  readonly subscribed: boolean
  readonly narrowed: boolean
  readonly isLoading: boolean
  readonly count: number
}) {
  const announced = useGridString('sharedFilter.resultCount', '{count} records', {
    count: props.count,
  })
  if (!props.subscribed) return undefined
  const text = props.narrowed && !props.isLoading ? announced : ''
  return (
    <div
      aria-live="polite"
      className="sr-only"
      data-slot="data-table-result-count"
    >
      {text}
    </div>
  )
}
