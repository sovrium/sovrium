/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId } from 'react'
import type { ReactElement } from 'react'

/** The choice a reader made: connected people, the others, or everyone. */
export type OnlineChoiceValue = 'true' | 'false' | undefined

/** The two labels of the choice, server-resolved in the page language. */
export interface OnlineChoiceLabels {
  readonly onlineLabel?: string
  readonly offlineLabel?: string
}

/**
 * The Online / Offline choice: two radios over the people a subscriber lists.
 * The server draws it only for a reader shown presence, so it is never offered
 * to anyone the directory would answer with no one. Choosing the checked one
 * again leaves it checked; a reader returns to everyone by reloading or by
 * the bar's other conditions — the choice narrows, it never hides itself.
 */
export function OnlineChoice({
  labels,
  value,
  onChange,
}: {
  readonly labels: OnlineChoiceLabels | undefined
  readonly value: OnlineChoiceValue
  readonly onChange: (value: OnlineChoiceValue) => void
}): ReactElement | undefined {
  const name = useId()
  if (labels === undefined) return undefined
  const option = (choice: 'true' | 'false', label: string) => (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input
        type="radio"
        name={name}
        value={choice}
        checked={value === choice}
        onChange={() => onChange(choice)}
      />
      {label}
    </label>
  )
  return (
    <div
      role="radiogroup"
      aria-label={`${labels.onlineLabel ?? 'Online'} / ${labels.offlineLabel ?? 'Offline'}`}
      className="inline-flex items-center gap-3"
    >
      {option('true', labels.onlineLabel ?? 'Online')}
      {option('false', labels.offlineLabel ?? 'Offline')}
    </div>
  )
}
