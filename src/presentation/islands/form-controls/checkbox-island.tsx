/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

function IndeterminateIcon(): ReactElement {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path
        d="M2 5H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon(): ReactElement {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path
        d="M2 5L4 7L8 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Checkbox island — wraps Base UI Checkbox for custom-styled checkboxes.
 *
 * Supports checked, unchecked, and indeterminate states with
 * keyboard interaction and ARIA attributes built-in.
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
        cn(
          'inline-flex items-center gap-2',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        ),
        className
      )}
      id={id}
      data-testid={testId}
    >
      <Checkbox.Root
        defaultChecked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        name={name}
        value={value}
        className="border-border bg-background-raised data-[checked]:border-primary data-[checked]:bg-primary data-[indeterminate]:border-primary data-[indeterminate]:bg-primary flex h-4 w-4 items-center justify-center rounded border transition-colors"
      >
        <Checkbox.Indicator
          keepMounted
          className="text-primary-fg data-[unchecked]:invisible"
        >
          {indeterminate ? <IndeterminateIcon /> : <CheckIcon />}
        </Checkbox.Indicator>
      </Checkbox.Root>
      {label && <span className="text-foreground text-md">{label}</span>}
    </label>
  )
}
