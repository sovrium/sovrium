/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui checkbox (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { Checkbox } from '@base-ui/react/checkbox'
import { cn } from '@/presentation/design/class-merge'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import type { ReactElement } from 'react'

interface CheckboxIslandProps {
  readonly checked?: boolean
  readonly indeterminate?: boolean
  readonly disabled?: boolean
  readonly label?: string
  readonly name?: string
  readonly value?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/** lucide's `minus`, the mark of an indeterminate box. */
function IndeterminateIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  )
}

/** lucide's `check`, the mark shadcn/ui's `Checkbox` draws. */
function CheckIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

/**
 * shadcn/ui `Checkbox` root, base-nova. One addition: an unchecked box is
 * outlined in the muted foreground rather than the input colour, the edge that
 * holds 3:1 against the page (WCAG 1.4.11) where an unfilled control has no
 * other.
 */
const CHECKBOX_ROOT =
  'peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-unchecked:border-muted-foreground'

/** shadcn/ui `Checkbox` indicator; `data-unchecked:invisible` keeps its box (see below). */
const CHECKBOX_INDICATOR =
  'grid place-content-center text-current transition-none [&>svg]:size-3.5 data-unchecked:invisible'

/** shadcn/ui `Label`, beside the box. */
const CHECKBOX_LABEL = 'inline-flex items-center gap-2 text-sm leading-none font-medium select-none'

/**
 * Checkbox island — Base UI `Checkbox`, drawn on shadcn/ui's `Checkbox` anatomy:
 * `data-slot="checkbox"` on the box, `data-slot="checkbox-indicator"` on its mark.
 *
 * Supports checked, unchecked, and indeterminate states with
 * keyboard interaction and ARIA attributes built-in. An indeterminate box is
 * filled like a checked one and draws lucide's minus rather than its check.
 *
 * ─── THE MARK KEEPS ITS BOX EVEN WHEN THERE IS NO MARK ─────────────────────
 *
 * `keepMounted` on the indicator, plus a hidden-when-unchecked treatment —
 * never a plain unmount. The indicator is the only thing inside the box, so the
 * box's baseline is taken from it; the box is the first item of the
 * `inline-flex` label, so the LABEL's baseline is taken from the box in turn.
 * Letting the indicator unmount therefore re-synthesised a baseline for the
 * whole row, and the row stepped 2px against the line it sits on every time it
 * was ticked: founder, _"quand elle est cochée, elle descend; quand elle est
 * décochée, elle remonte… il faudrait que ce soit stable"_. Measured against
 * the `indeterminate` drawing, whose indicator IS mounted in both states and
 * holds still at 0.00 — one specimen on the same page already showing what the
 * others should do.
 *
 * `invisible` (`visibility: hidden`) rather than `opacity-0` or a conditional
 * child: the mark has to keep its box for the baseline to keep its place, which
 * is the whole of the fix.
 *
 * An indeterminate checkbox carries neither `data-checked` nor `data-unchecked`
 * — Base UI emits `data-indeterminate` instead of either — so the dash is not
 * caught by this and keeps painting.
 */
export default function CheckboxIsland({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  name,
  value,
  className,
  id,
  'data-testid': testId,
}: CheckboxIslandProps): ReactElement {
  return (
    <label
      className={resolveClasses(
        cn(CHECKBOX_LABEL, disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'),
        className
      )}
      id={id}
      data-testid={testId}
      data-slot="label"
    >
      <Checkbox.Root
        defaultChecked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        name={name}
        value={value}
        className={CHECKBOX_ROOT}
        data-slot="checkbox"
      >
        <Checkbox.Indicator
          keepMounted
          className={CHECKBOX_INDICATOR}
          data-slot="checkbox-indicator"
        >
          {indeterminate ? <IndeterminateIcon /> : <CheckIcon />}
        </Checkbox.Indicator>
      </Checkbox.Root>
      {label && <span>{label}</span>}
    </label>
  )
}
