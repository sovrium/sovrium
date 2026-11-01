/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { Effect } from 'effect'

/**
 * The secret the running server keys its daily visitor identifiers with.
 *
 * One secret per calendar day, held for the life of the server and never
 * written anywhere: a new day, or a new server, starts from a new secret, so
 * an identifier means nothing outside the day and the instance that issued it.
 */
export class VisitorSecret extends Context.Service<
  VisitorSecret,
  {
    /**
     * The secret of one calendar day (`YYYY-MM-DD` in the operator timezone).
     * Only the newest day asked for is held: a later day replaces it, and an
     * earlier day gets a one-off secret that leaves the held one in place.
     */
    readonly secretFor: (day: string) => Effect.Effect<Uint8Array<ArrayBuffer>>
  }
>()('VisitorSecret') {}
