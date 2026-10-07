/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { validatePostureFlags } from '@/infrastructure/process/security-posture'

/**
 * Raised when `SOVRIUM_ALLOW_INSECURE` or `SOVRIUM_ALLOW_PRIVATE_OUTBOUND`
 * holds a value other than `1`, `true` or empty.
 *
 * `message` is the one-line refusal `formatRuntimeError` prints, naming the
 * variable, the quoted value and the accepted values. Exported only because
 * `validateOperatorEnv` names the tag in its declared error channel; no caller
 * catches it — an operator reads it. Same contract as `EcoEnvError`.
 */
export class PostureFlagEnvError extends Data.TaggedError('PostureFlagEnvError')<{
  readonly message: string
}> {}

/**
 * Refuse the boot on a posture flag the operator may have meant as "off".
 *
 * An operator who writes `0` or `false` means "off", and a flag that counted
 * any non-empty value as set would relax CSRF, `Secure` cookies and the
 * outbound private-address guard instead. Both flags are read by value, and
 * anything that is neither accepted nor empty stops the command here, before a
 * relaxed server could serve a single request.
 */
export const validatePostureFlagEnv: Effect.Effect<void, PostureFlagEnvError> = Effect.suspend(
  () => {
    const refusal = validatePostureFlags(process.env)
    return refusal === undefined
      ? Effect.void
      : Effect.fail(new PostureFlagEnvError({ message: refusal }))
  }
)
