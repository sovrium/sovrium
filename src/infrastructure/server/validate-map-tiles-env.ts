/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { parseMapTilesEnvConfig } from '@/domain/models/process-env/map-tiles'

/**
 * Raised when `MAP_TILES_URL` is set to something a browser could not fetch
 * tiles from safely: an address that is not `https://`, or one missing any of
 * the `{z}`, `{x}`, `{y}` placeholders.
 *
 * Exported for one reason only: `validateOperatorEnv` names this tag in its
 * declared error channel, and a `.d.ts` cannot reference a name its declaring
 * module keeps to itself. No caller catches it by tag — an operator reads it.
 */
export class MapTilesEnvError extends Data.TaggedError('MapTilesEnvError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Fail-fast on a malformed `MAP_TILES_URL`. The map renderer reads the value
 * per page; without this pass a typo would surface as a broken basemap in a
 * reader's browser instead of a refusal on the operator's terminal. Unset (or
 * empty) is valid: maps then draw a neutral grid and request no tile.
 */
export const validateMapTilesEnv: Effect.Effect<void, MapTilesEnvError> = Effect.try({
  try: () => parseMapTilesEnvConfig(process.env),
  catch: (cause) =>
    new MapTilesEnvError({
      message:
        'Invalid MAP_TILES_URL: expected an https:// address containing {z}, {x} and {y}' +
        (process.env['MAP_TILES_URL'] === undefined
          ? ''
          : ` (got "${process.env['MAP_TILES_URL']}")`),
      cause,
    }),
}).pipe(Effect.asVoid)
