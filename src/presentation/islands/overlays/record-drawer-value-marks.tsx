/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The marks a read-only drawer draws for a value the grid draws as more than
 * text: a chosen option as a badge in its option colour, a person as an avatar
 * beside the name, a checkbox as a check the reader cannot toggle.
 *
 * They wear the grid cell's own class recipes, and an option badge its paint
 * resolved on the server as the grid's pill paints it, so one value reads the
 * same in the cell and in the drawer. The colour arithmetic stays on the
 * server: the drawer receives a finished `value → paint` map.
 */

import { deriveInitials } from '@/presentation/design/avatar-initials'
import {
  computeStatusPillClasses,
  computeUserAvatarClasses,
  computeUserNameClasses,
  computeUserPillClasses,
} from '@/presentation/design/cell-affordances-default-classes'
import { readsAsTrue } from '../runtime/cell-value-semantics'
import type { OptionChipPaint } from '@/presentation/design/option-chip-paint'
import type { ReactElement } from 'react'

/** A chosen option as the grid's badge, painted in its option colour when it has one. */
export function OptionBadge({
  value,
  paint,
}: {
  readonly value: string
  readonly paint: OptionChipPaint | undefined
}): ReactElement {
  return (
    <span
      data-component-type="badge"
      className={computeStatusPillClasses()}
      style={paint?.style}
    >
      {paint?.dot && (
        <span
          data-badge-dot=""
          className={paint.dot.className}
          style={paint.dot.style}
        />
      )}
      {value}
    </span>
  )
}

/** A person as the grid draws one: an avatar of their initials beside the name. */
export function UserChip({ name }: { readonly name: string }): ReactElement {
  return (
    <span className={computeUserPillClasses()}>
      <span
        aria-hidden="true"
        data-component-type="avatar"
        className={computeUserAvatarClasses()}
      >
        {deriveInitials(name) || '?'}
      </span>
      <span className={computeUserNameClasses()}>{name}</span>
    </span>
  )
}

/** A checkbox value as a check mark the reader cannot toggle — never the word `true`. */
export function ReadOnlyCheck({
  value,
  label,
}: {
  readonly value: unknown
  readonly label: string
}): ReactElement {
  return (
    <input
      type="checkbox"
      data-component-type="checkbox"
      aria-label={label}
      checked={readsAsTrue(value)}
      disabled
      readOnly
      className="accent-primary h-4 w-4"
    />
  )
}
