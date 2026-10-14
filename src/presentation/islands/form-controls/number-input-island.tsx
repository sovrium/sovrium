/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MinusGlyph, PlusGlyph } from '@/presentation/design/control-glyphs'
import {
  computeInputGroupAddonClasses,
  computeInputGroupLabelClasses,
  computeInputGroupRootClasses,
  computeInputGroupClasses,
  computeInputGroupFieldClasses,
  computeInputGroupIconButtonClasses,
} from '@/presentation/design/input-group-default-classes'
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

/**
 * One step button, in the addon at its end of the group: shadcn/ui's
 * `InputGroupButton` (ghost, `icon-xs`) drawing lucide's minus or plus. Its
 * accessible name is the direction; the glyph is hidden.
 */
function StepperButton({ direction, onClick, disabled }: StepperButtonProps): ReactElement {
  const align = direction === 'increment' ? 'inline-end' : 'inline-start'
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={computeInputGroupAddonClasses({ align })}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={direction}
        disabled={disabled}
        data-slot="input-group-button"
        data-size="icon-xs"
        className={computeInputGroupIconButtonClasses()}
      >
        {direction === 'increment' ? <PlusGlyph /> : <MinusGlyph />}
      </button>
    </div>
  )
}

/** The number centred in its group, without the browser's own spin arrows. */
const NUMBER_FIELD =
  'text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/** Whether `value` already sits on (or past) a declared bound in one direction. */
const atBound = (value: number, bound: number | undefined, direction: 1 | -1): boolean =>
  typeof bound === 'number' && !Number.isNaN(value) && direction * (value - bound) >= 0

/** The field's label, above the group: shadcn/ui's `FieldLabel`. */
function NumberInputLabel({
  htmlFor,
  label,
}: {
  readonly htmlFor: string | undefined
  readonly label: string | undefined
}): ReactElement | undefined {
  if (label === undefined) return undefined
  return (
    <label
      htmlFor={htmlFor}
      data-slot="field-label"
      className={computeInputGroupLabelClasses()}
    >
      {label}
    </label>
  )
}

/**
 * Number-input island — shadcn/ui's `Field` holding one `InputGroup`: the label
 * above, then a decrement button, a native `<input type="number">` (which
 * gives `role="spinbutton"` and the arrow keys for free) and an increment
 * button, in one bordered box. The buttons move the value by `step` (default
 * `1`) and a typed value is clamped to `min` / `max` on blur.
 *
 * A step button is disabled when the value already sits on the bound it would
 * cross, so the control never offers a press that would do nothing.
 *
 * Mounted as an eager island so the change handler is wired before anyone
 * interacts with the input — the same reasoning as the file-upload island.
 */
export default function NumberInputIsland(props: NumberInputIslandProps): ReactElement {
  const { id, label, min, max, step, defaultValue, name } = props
  const steppers = props.showStepper !== false
  const disabled = props.disabled === true
  const stepAmount = typeof step === 'number' && step > 0 ? step : 1
  const { value, handleChange, handleBlur, handleIncrement, handleDecrement } = useNumberInputState(
    { defaultValue, min, max, stepAmount }
  )

  return (
    <div
      className={computeInputGroupRootClasses()}
      data-slot="field"
      data-component="number-input-island"
    >
      <NumberInputLabel
        htmlFor={id}
        label={label}
      />
      <div
        role="group"
        data-slot="input-group"
        className={computeInputGroupClasses({ fit: true })}
      >
        {steppers && (
          <StepperButton
            direction="decrement"
            onClick={handleDecrement}
            disabled={disabled || atBound(value, min, -1)}
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
          data-slot="input-group-control"
          className={`${computeInputGroupFieldClasses({ fit: true })} ${NUMBER_FIELD}`}
        />
        {steppers && (
          <StepperButton
            direction="increment"
            onClick={handleIncrement}
            disabled={disabled || atBound(value, max, 1)}
          />
        )}
      </div>
    </div>
  )
}
