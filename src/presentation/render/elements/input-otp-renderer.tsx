/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import type { ElementProps } from './html-element-renderer'
import type { ReactElement } from 'react'

/** How many boxes when the author declares no `maxLength`: a common mailed code. */
const DEFAULT_LENGTH = 6

/** The box count: the author's `maxLength` when it is a sane positive integer. */
const otpLength = (props: ElementProps): number => {
  const declared = Number(props['maxLength'] ?? props['maxlength'])
  return Number.isInteger(declared) && declared > 0 && declared <= 12 ? declared : DEFAULT_LENGTH
}

const SLOT =
  'relative flex size-8 items-center justify-center border-y border-r border-input text-sm first:rounded-l-lg first:border-l last:rounded-r-lg dark:bg-input/30'

/**
 * The `input-otp` control: a verification code, one box per character.
 *
 * The server draws the boxes with the ONE real input laid transparently over
 * them, the shape the `input-otp` island mounts, so the page has the control's
 * size and a working field before any script runs: a code typed or autofilled
 * then is carried into the island on mount. Two attributes carry the
 * capability and stay on that input: `autocomplete="one-time-code"`, which a
 * phone keys its offer-the-code-from-the-SMS behaviour on, and
 * `inputmode="numeric"`, which brings up a digit keypad. Its `type` is `text`:
 * `one-time-code` is not an HTML input type.
 *
 * `label` is mirrored into both `aria-label` and a sibling `<label>`, so a
 * verification page needs no `id` for the control to be findable by its name.
 */
export function renderInputOtp(config: {
  readonly props: ElementProps
  readonly label?: string
}): ReactElement {
  const { props, label } = config
  const id = props.id as string | undefined
  const name = props.name as string | undefined
  const ariaLabel = label ?? (props['aria-label'] as string | undefined)
  const length = otpLength(props)
  const islandProps = {
    ...(id !== undefined && { id }),
    ...(name !== undefined && { name }),
    ...(ariaLabel !== undefined && { ariaLabel }),
    length,
    ...(props.required === true && { required: true }),
    ...(props.disabled === true && { disabled: true }),
    ...(typeof props.defaultValue === 'string' && { defaultValue: props.defaultValue }),
  }
  return (
    <>
      {label !== undefined && id !== undefined && <label htmlFor={id}>{label}</label>}
      <div
        data-island="input-otp"
        data-component-type={hostComponentType(props)}
        data-island-props={JSON.stringify(islandProps)}
        className={props.className as string | undefined}
      >
        <div
          data-slot="input-otp"
          className="relative flex items-center"
        >
          <div
            data-slot="input-otp-group"
            className="flex items-center rounded-lg"
          >
            {Array.from({ length }, (_unused, index) => (
              <div
                key={index}
                data-slot="input-otp-slot"
                className={SLOT}
              />
            ))}
          </div>
          <input
            id={id}
            name={name}
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={length}
            aria-label={ariaLabel}
            required={props.required === true}
            disabled={props.disabled === true}
            className="absolute inset-0 text-transparent caret-transparent opacity-0"
          />
        </div>
      </div>
    </>
  )
}
