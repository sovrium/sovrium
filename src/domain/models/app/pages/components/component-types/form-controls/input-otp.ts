/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `input-otp` — a short verification code typed one character per box, pasted
 * or autofilled. shadcn/ui's Input OTP, under its own name.
 *
 * ## A promotion, not a new control
 *
 * The box already ships: it is `input` with `inputType: one-time-code`, which
 * renders the autofill hint and the numeric keyboard a phone keys on. This type
 * is that box without the key that selected it, so its keys are the `input`
 * keys minus `inputType`, picked from {@link inputFields}. `inputType` is
 * refused with a sentence saying the box is always a one-time code.
 *
 * The per-box drawing (slots, groups, a pattern) is a later extension; at
 * promotion the type carries exactly the behaviour the input type has today.
 */

import { Schema } from 'effect'
import { inputFields } from './input'

export const InputOtpTypeLiteral = Schema.Literal('input-otp')

export const inputOtpFields = {
  props: inputFields.props,
  classes: inputFields.classes,
  visibility: inputFields.visibility,
  i18n: inputFields.i18n,
} as const
