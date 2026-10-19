/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import { CalendarGlyph, ChevronDownGlyph } from '@/presentation/design/control-glyphs'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { computeInputGroupIconButtonClasses } from '@/presentation/design/input-group-default-classes'
import {
  computeSelectIconClasses,
  computeSelectTriggerClasses,
  computeSelectValueClasses,
} from '@/presentation/design/select-default-classes'
import type { CSSProperties, ReactElement } from 'react'

/**
 * The server-rendered skeletons of the two form controls the browser cannot
 * draw in the app's design — the Select and the date picker — painted as the
 * island will paint them, so the page does not move when it mounts.
 *
 * A skeleton already HOLDS the field's value: a named input carries it, so a
 * form served without its script still posts it, and a rule served hidden has
 * it disabled. It refuses interaction until the island mounts — the Select's
 * trigger is `aria-disabled`, the date box read-only — so a click or a key
 * landing early is not lost on markup about to be replaced.
 *
 * The named input is visually hidden but NOT `type="hidden"`: the browser
 * validates it (a required choice left empty is `valueMissing`) and the
 * form's runtime finds it as the field's control. It is laid over the visible
 * control at its size, clipped to nothing, as the islands lay theirs.
 */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
}

/** The input a skeleton carries its field's value in — see the module note. */
function HeldValue({
  name,
  value,
  required,
  disabled,
}: {
  readonly name: string
  readonly value: string
  readonly required: boolean
  readonly disabled: boolean
}): ReactElement {
  return (
    <input
      type="text"
      name={name}
      defaultValue={value}
      tabIndex={-1}
      aria-hidden="true"
      style={VISUALLY_HIDDEN}
      {...(required && { required: true })}
      {...(disabled && { disabled: true })}
    />
  )
}

export interface ChoiceSelectSkeletonProps {
  /** The trigger's id, which a `<label for>` names it by (none inside a wrapping label). */
  readonly id?: string
  readonly name: string
  readonly value: string
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
  /** The leading "no answer" choice's label, shown while nothing is chosen. */
  readonly emptyLabel: string
  readonly required: boolean
  /** True when a rule serves the field hidden: its value is neither validated nor sent. */
  readonly disabled: boolean
}

const TRIGGER_CLASSES = cn(computeSelectTriggerClasses(), 'w-full')

/** The Select's skeleton: its trigger showing the chosen option, and the held value. */
export function ChoiceSelectSkeleton(props: ChoiceSelectSkeletonProps): ReactElement {
  const chosen = props.options.find((option) => option.value === props.value)
  return (
    <span className="relative block w-full">
      <button
        type="button"
        role="combobox"
        {...(props.id === undefined ? {} : { id: props.id })}
        aria-disabled="true"
        aria-expanded="false"
        aria-haspopup="listbox"
        className={TRIGGER_CLASSES}
        data-slot="select-trigger"
        data-size="default"
        data-component-type="select"
        data-name={props.name}
        {...(chosen === undefined && { 'data-placeholder': '' })}
      >
        <span
          className={computeSelectValueClasses()}
          data-slot="select-value"
        >
          {chosen?.label ?? props.emptyLabel}
        </span>
        <ChevronDownGlyph className={computeSelectIconClasses()} />
      </button>
      <HeldValue
        name={props.name}
        value={chosen === undefined ? '' : props.value}
        required={props.required}
        disabled={props.disabled}
      />
    </span>
  )
}

export interface DateBoxSkeletonProps {
  readonly id?: string
  /** The field's name; the box carries it, unless `valueName` holds it instead. */
  readonly name?: string
  readonly valueName?: string
  readonly value: string
  readonly required: boolean
  readonly disabled: boolean
  readonly placeholder?: string
  readonly pickLabel: string
  /** Attributes the box carries beside its own (a guidance line it is described by). */
  readonly boxAttributes?: Readonly<Record<string, string>>
}

const BOX_CLASSES = cn(computeInputDefaultClasses(), 'pr-9')
const BUTTON_CLASSES = cn(
  computeInputGroupIconButtonClasses(),
  'absolute top-1/2 right-1 -translate-y-1/2'
)

/** The date picker's skeleton: the read-only box, its calendar button, and the held day. */
export function DateBoxSkeleton(props: DateBoxSkeletonProps): ReactElement {
  return (
    <span className="relative block w-full">
      <input
        type="text"
        {...(props.id === undefined ? {} : { id: props.id })}
        data-component-type="date-picker"
        defaultValue={props.value}
        autoComplete="off"
        readOnly
        className={BOX_CLASSES}
        {...(props.name === undefined ? {} : { name: props.name })}
        {...(props.required && { 'aria-required': 'true' })}
        {...(props.placeholder === undefined ? {} : { placeholder: props.placeholder })}
        {...(props.name !== undefined && props.disabled && { disabled: true })}
        {...props.boxAttributes}
      />
      <button
        type="button"
        aria-label={props.pickLabel}
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-disabled="true"
        className={BUTTON_CLASSES}
      >
        <CalendarGlyph />
      </button>
      {props.valueName !== undefined && (
        <HeldValue
          name={props.valueName}
          value={props.value}
          required={props.required}
          disabled={props.disabled}
        />
      )}
    </span>
  )
}
