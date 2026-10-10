/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { parsePlatformSso } from '@/domain/models/process-env/platform-sso'

/**
 * Raised when the `SOVRIUM_PLATFORM_SSO_*` variables are set only in part, or
 * name an issuer that is not an https address (http on a loopback host only).
 * The message names the variables and never echoes a value — the set includes
 * the client secret.
 *
 * Exported because `validateOperatorEnv` names this tag in its declared error
 * channel, and a `.d.ts` cannot reference a name its module keeps to itself.
 */
export class PlatformSsoEnvError extends Data.TaggedError('PlatformSsoEnvError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Fail-fast on a partial or malformed "Sign in with Sovrium Cloud"
 * environment. Without it, the provider would be built — or silently left out —
 * on the first sign-in, and a hosted app's owner would find no way in.
 */
export const validatePlatformSsoEnv: Effect.Effect<void, PlatformSsoEnvError> = Effect.try({
  try: () => parsePlatformSso(process.env),
  catch: (cause) =>
    new PlatformSsoEnvError({
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    }),
}).pipe(Effect.asVoid)
