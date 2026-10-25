/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * A condition that stops `sovrium restore` with nothing restored. `reason` is
 * the clause the CLI completes with "— nothing was restored."
 */
export class RestoreRefusal extends Data.TaggedError('RestoreRefusal')<{
  readonly reason: string
  readonly guidance: string
  /** What a failed step reported, line by line, when there is something to show. */
  readonly detail?: readonly string[]
}> {}

/** A {@link RestoreRefusal}, with `detail` only when there is some. */
export const restoreRefusal = (
  reason: string,
  guidance: string,
  detail?: readonly string[]
): Readonly<RestoreRefusal> =>
  new RestoreRefusal({ reason, guidance, ...(detail === undefined ? {} : { detail }) })
