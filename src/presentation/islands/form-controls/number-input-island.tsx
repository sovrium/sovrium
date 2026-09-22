/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeFormFieldLabelClasses } from '@/presentation/design/form-layout-classes'
import {
  computeNumberInputFieldClasses,
  computeNumberInputStepperClasses,
  computeNumberInputWrapperClasses,
} from './numeric-default-classes'
import { useNumberInputState } from './use-number-input-state'
import type { ReactElement } from 'react'

interface NumberInputIslandProps {
  readonly id?: string
  readonly label?: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly defaultValue?: number
  readonly showStepper?: boolean
  readonly disabled?: boolean
  readonly name?: string
}

interface StepperButtonProps {
  readonly direction: 'increment' | 'decrement'
  readonly onClick: () => void
  readonly disabled: boolean
}

function StepperButton({ direction, onClick, disabled }: StepperButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction}
      disabled={disabled}
      className={computeNumberInputStepperClasses({ direction })}
    >
      {direction === 'increment' ? '+' : '−'}
    </button>
  )
}

/**
 * The label naming the control, at the step the `field` renderer already gives
 * the label above its own control.
 *
 * A component of its own rather than four lines inline: the island body sits
 * against the 60-line cap, and a label that has to be spelled out at the call
 * site is a label the next branch added here will forget to rule.
 */
function NumberInputLabel({
  htmlFor,
  label,
}: {
  readonly htmlFor: string | undefined
  readonly label: string
}): ReactElement {
  return (
    <label
      htmlFor={htmlFor}
      className={computeFormFieldLabelClasses()}
    >
      {label}
    </label>
  )
}

/**
 * Number-input island — composes a native `<input type="number">` (which
 * gives us `role="spinbutton"` and keyboard arrow handling for free) with
 * explicit `+` / `−` stepper buttons and on-blur value clamping to `min` /
 * `max`. The buttons increment / decrement by `step` (default `1`).
 *
 * Default styling lives in `numeric-default-classes.ts` (prestyled-by-default
 *): the outer wrapper carries the border + focus-within ring,
 * the inner `<input>` is transparent so the wrapper surface shows through,
 * and the stepper buttons share dividers with the field for a single
 * cohesive control. The schema author writes `{ type: 'number-input' }` and
 * gets the full bordered-with-flanking-steppers recipe.
 *
 * The label takes `computeFormFieldLabelClasses` — the SAME recipe the `field`
 * renderer paints on the label above its own control — rather than a step of
 * its own. Carrying no class at all is not "unstyled": it inherits the document
 * root, which is 16px, so the label drew LARGER than the 13px control it named
 * and larger than every label beside it. A label is ruled by the form it
 * belongs to, and there is exactly one form-label step in this system.
 *
 * Mounted as an eager island so the React change-handler is wired before
 * Playwright (or the user) interacts with the input — same reasoning as the
 * file-upload island.
 */
export default function NumberInputIsland({
  id,
  label,
  min,
  max,
  step,
  defaultValue,
  showStepper = true,
  disabled = false,
  name,
}: NumberInputIslandProps): ReactElement {
  const stepAmount = typeof step === 'number' && step > 0 ? step : 1
  const { value, handleChange, handleBlur, handleIncrement, handleDecrement } = useNumberInputState(
    { defaultValue, min, max, stepAmount }
  )

  return (
    <span
      className="inline-flex items-center gap-2"
      data-component="number-input-island"
    >
      {label !== undefined && (
        <NumberInputLabel
          htmlFor={id}
          label={label}
        />
      )}
      <span className={computeNumberInputWrapperClasses()}>
        {showStepper && (
          <StepperButton
            direction="decrement"
            onClick={handleDecrement}
            disabled={disabled}
          />
        )}
        <input
          id={id}
          name={name}
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={stepAmount}
          disabled={disabled}
          value={Number.isNaN(value) ? '' : value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={computeNumberInputFieldClasses()}
        />
        {showStepper && (
          <StepperButton
            direction="increment"
            onClick={handleIncrement}
            disabled={disabled}
          />
        )}
      </span>
    </span>
  )
}
