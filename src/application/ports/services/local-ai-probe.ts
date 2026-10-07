/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a local model server answers, as the boot-time AI routing check sees
 * it. Unreachability is the probe's RESULT, never its failure: every failure
 * mode (no URL, refused connection, timeout, non-2xx) answers `false`.
 */

import { Context, type Effect } from 'effect'

export class LocalAiProbe extends Context.Service<
  LocalAiProbe,
  {
    readonly isReachable: (baseUrl: string | undefined) => Effect.Effect<boolean>
  }
>()('LocalAiProbe') {}
