/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `input-otp` island: a verification code drawn one box per character
 * (`parts/otp-primitives`, shadcn's `input-otp`).
 *
 * The value is still ONE string in ONE named input: input-otp keeps a single
 * real `<input>` under the boxes, so a form posts the code exactly as the
 * single box did, and the autofill hint (`autocomplete="one-time-code"`) and
 * the numeric keyboard (`inputmode="numeric"`) stay on that input, where a
 * phone looks for them.
 */

import { useState, type ReactElement } from 'react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../parts/otp-primitives'

interface InputOtpIslandProps {
  readonly id?: string
  readonly name?: string
  readonly ariaLabel?: string
  /** How many characters, one box each. */
  readonly length?: number
  readonly required?: boolean
  readonly disabled?: boolean
  readonly defaultValue?: string
  /** Values typed into the server-drawn box before the island mounted, by name. */
  readonly initialValues?: Readonly<Record<string, string>>
}

/** The number of boxes when none is declared: the length of a common mailed code. */
const DEFAULT_LENGTH = 6

export default function InputOtpIsland({
  id,
  name,
  ariaLabel,
  length = DEFAULT_LENGTH,
  required,
  disabled,
  defaultValue,
  initialValues,
}: InputOtpIslandProps): ReactElement {
  const typed = name === undefined ? undefined : initialValues?.[name]
  const [value, setValue] = useState(typed ?? defaultValue ?? '')
  return (
    <InputOTP
      id={id}
      name={name}
      aria-label={ariaLabel}
      autoComplete="one-time-code"
      inputMode="numeric"
      maxLength={length}
      value={value}
      onChange={setValue}
      required={required}
      disabled={disabled}
    >
      <InputOTPGroup>
        {Array.from({ length }, (_unused, index) => (
          <InputOTPSlot
            key={index}
            index={index}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
