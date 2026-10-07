/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `map` — the records of a table, drawn as pins at their `geolocation` value.
 *
 * ─── WHY THE TILES ARE NOT CONFIG ──────────────────────────────────────────
 *
 * A basemap is somebody's server. Naming one in the app config would ship a
 * third-party request to every reader of every app built from that config, and
 * a template is copied unscrubbed into strangers' projects. So the tile URL is
 * an OPERATOR variable (`MAP_TILES_URL`, see `process-env/map-tiles.ts`) with
 * no default provider: unset, the map draws a neutral grid basemap and the pins
 * still mean what they mean. The schema carries nothing about tiles at all.
 *
 * ─── THE PIN IS A RECORD, SO THE CLICK IS A RECORD CLICK ───────────────────
 *
 * `onPinClick` takes the two verbs a card takes (`navigate`, `openDrawer`) and
 * no others, by reusing {@link CardClickActionSchema}: a pin, a card and a list
 * item are the same thing — one record — so they share one vocabulary.
 *
 * ─── ACCESSIBILITY IS NOT AN OPTION ────────────────────────────────────────
 *
 * The list twin (every pin as a button in list order) is always rendered.
 * There is deliberately no key to turn it off: a map that only a pointer can
 * read is a map a keyboard or a screen reader cannot read at all.
 */

import { Schema } from 'effect'
import { CardClickActionSchema } from '../../../action'
import { DataSourceSchema } from '../../../data-source'
import { coreFields } from '../../modules/core'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'

export const MapTypeLiteral = Schema.Literal('map')

/** A point on the map, in degrees. */
export const MapCenterSchema = Schema.Struct({
  lat: Schema.Finite.pipe(
    Schema.annotate({ description: 'Latitude of the centre, in degrees' }),
    Schema.check(Schema.isBetween({ minimum: -90, maximum: 90 }))
  ),
  lng: Schema.Finite.pipe(
    Schema.annotate({ description: 'Longitude of the centre, in degrees' }),
    Schema.check(Schema.isBetween({ minimum: -180, maximum: 180 }))
  ),
}).annotate({
  identifier: 'MapCenter',
  title: 'Map Center',
  description:
    'Point the map opens centred on. Omitted, the map opens fitted to the pins it draws.',
})

export const mapFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  // The shared DB binding, unannotated here: it carries an identifier, and a
  // use-site annotation would fork its definition in the published schema.
  dataSource: Schema.optional(DataSourceSchema),
  locationField: Schema.String.pipe(
    Schema.annotate({
      description: 'The `geolocation` field of the bound table that places each pin',
      examples: ['location', 'office_location'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  labelField: Schema.String.pipe(
    Schema.annotate({
      description:
        'The field whose value names each pin — on its card, in its accessible name and in the list twin',
      examples: ['name', 'title'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  colorField: Schema.optional(
    Schema.String.annotate({
      description:
        'A single-select or status field whose option colour fills each pin. Omitted, every pin is drawn in the foreground ink.',
      examples: ['status'],
    })
  ),
  onPinClick: Schema.optional(CardClickActionSchema),
  cluster: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Group nearby pins into one marker carrying their count (default: true). Set false to always draw every pin.',
    })
  ),
  center: Schema.optional(MapCenterSchema),
  zoom: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Zoom level the map opens at, from 0 (the whole world) to 20 (a building). Omitted with center, the map fits its pins.',
        examples: [4, 12],
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 20 }))
    )
  ),
  height: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Height of the map in pixels (default: 400). Its width follows its container.',
        examples: [400, 560],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  emptyMessage: Schema.optional(
    Schema.String.annotate({
      description:
        'Sentence shown when no record has a location to place (default: "No locations to show."). Supports $t: references.',
    })
  ),
} as const
