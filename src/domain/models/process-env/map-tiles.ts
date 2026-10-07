/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Map tiles environment configuration.
 *
 * Env vars: MAP_TILES_URL, MAP_TILES_ATTRIBUTION.
 *
 * ## Why env and NOT AppSchema
 *
 * A basemap is a third party's server, fetched by every reader's browser. A
 * tile URL written into an app config would ship that request to every app
 * built from the config — including every project scaffolded from a template —
 * and would decide, on the operator's behalf, which provider sees their
 * readers' map views. Which provider (if any) is an OPERATOR decision about
 * the deployment, so it lives in the environment, like the storage, mail and
 * AI providers.
 *
 * ## No default provider
 *
 * Unset, a `map` component draws a neutral grid basemap and its pins. That is
 * deliberately not a degraded mode to be fixed by shipping a default URL: a
 * Sovrium app makes no third-party request the operator did not configure.
 *
 * ## The URL is a template
 *
 * `https://tiles.example.com/{z}/{x}/{y}.png` — the three placeholders are
 * required, and only `https:` is accepted, since a tile fetched over plain
 * HTTP from an HTTPS page is blocked as mixed content anyway.
 */
export const MapTilesEnvSchema = Schema.Struct({
  url: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Tile URL template for map components (MAP_TILES_URL), an https address containing {z}, {x} and {y}. Unset, maps draw a neutral grid basemap and request no tiles.',
        examples: ['https://tiles.example.com/{z}/{x}/{y}.png'],
      }),
      Schema.check(
        Schema.makeFilter(
          (value: string) =>
            (value.startsWith('https://') &&
              value.includes('{z}') &&
              value.includes('{x}') &&
              value.includes('{y}')) ||
            'MAP_TILES_URL must be an https:// address containing {z}, {x} and {y}'
        )
      )
    )
  ),
  attribution: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Attribution line drawn in the corner of every map (MAP_TILES_ATTRIBUTION), as the tile provider’s licence requires',
        examples: ['© OpenStreetMap contributors'],
      })
    )
  ),
})

export type MapTilesEnvConfig = Schema.Schema.Type<typeof MapTilesEnvSchema>

/**
 * Read the map tiles configuration from the environment. An empty variable is
 * treated as unset, so `MAP_TILES_URL=` in a `.env` file means "no tiles".
 */
export const parseMapTilesEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): MapTilesEnvConfig => {
  const read = (key: string): string | undefined => {
    const value = processEnv[key]?.trim()
    return value === undefined || value === '' ? undefined : value
  }
  return Schema.decodeSync(MapTilesEnvSchema)({
    url: read('MAP_TILES_URL'),
    attribution: read('MAP_TILES_ATTRIBUTION'),
  })
}
