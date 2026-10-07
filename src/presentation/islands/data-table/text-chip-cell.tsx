/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- TextChipCell is the
   island-internal chip component, co-located with `textCellContent`, the
   helper that decides whether a text value is drawn as that chip or as plain
   text and returns JSX either way, so it cannot move to a `.ts` sibling. */
import { computeStatusPillClasses } from '../../design/cell-affordances-default-classes'
import { cn } from '../../design/class-merge'
import { EMPTY_VALUE, isMissing } from './cell-empty'
import { matchedCellTone } from './column-presentation'
import type { CellFieldOptions } from './cell-renderers'
import type { BadgeForm } from '../../design/option-chip-paint'
import type { FieldColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { Tone } from '@/domain/models/app/pages/components/shared-schemas'

/**
 * A tone's chip colours: the dot of `outline-dot`, the edge of `outline`, and
 * the ground, ink and edge of `filled`. Spelled out whole so the scan-free
 * compiler sees every literal.
 */
const TONE_CHIP: Readonly<
  Record<Tone, { readonly dot: string; readonly outline: string; readonly filled: string }>
> = {
  success: {
    dot: 'bg-success',
    outline: 'border-success-border',
    filled: 'bg-success-bg text-success-fg border-success-border',
  },
  warning: {
    dot: 'bg-warning',
    outline: 'border-warning-border',
    filled: 'bg-warning-bg text-warning-fg border-warning-border',
  },
  error: {
    dot: 'bg-error',
    outline: 'border-error-border',
    filled: 'bg-error-bg text-error-fg border-error-border',
  },
  muted: {
    dot: 'bg-foreground-muted',
    outline: 'border-border',
    filled: 'bg-background-subtle text-foreground-muted border-border',
  },
}

/** No ground: a text chip is an outline unless it is `filled` with a tone. */
const NO_GROUND = { backgroundColor: 'transparent' } as const

/**
 * A text column's value drawn as a chip (`columns[].badgeForm` on a column that
 * is not an option field): an outline, an outline with a dot, or a filled pill,
 * coloured by the tone of the column's matching `cellStyle` rule. A value no
 * rule matches is a neutral outline, with no dot. The `chip` part styles it.
 */
export function TextChipCell({
  value,
  form,
  tone,
  chipClassName,
}: {
  readonly value: unknown
  readonly form: BadgeForm
  readonly tone: Tone | undefined
  readonly chipClassName: string | undefined
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const colours = tone === undefined ? undefined : TONE_CHIP[tone]
  const filled = form === 'filled' && colours !== undefined
  const toneClass = filled ? colours.filled : form === 'outline' ? colours?.outline : undefined
  return (
    <span
      data-component-type="badge"
      className={cn(computeStatusPillClasses(), toneClass, chipClassName)}
      style={filled ? undefined : NO_GROUND}
    >
      {form === 'outline-dot' && colours !== undefined && (
        <span
          data-badge-dot=""
          className={`size-1.5 shrink-0 rounded-full ${colours.dot}`}
        />
      )}
      {String(value)}
    </span>
  )
}

/**
 * A text value as written, or as a chip coloured by its matching tone when the
 * column asks for one.
 */
export function textCellContent(
  value: unknown,
  col: Pick<FieldColumn, 'badgeForm' | 'cellStyle'>,
  fieldOptions: CellFieldOptions | undefined
): React.ReactNode {
  if (col.badgeForm === undefined) return String(value ?? '')
  return (
    <TextChipCell
      value={value}
      form={col.badgeForm}
      tone={matchedCellTone(value, col.cellStyle)}
      chipClassName={fieldOptions?.display?.chipClassName}
    />
  )
}
