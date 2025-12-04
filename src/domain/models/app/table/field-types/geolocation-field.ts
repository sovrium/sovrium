/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Geolocation Field
 *
 * Stores geographic coordinates (latitude and longitude).
 * Used for location-based features like maps, distance calculations, and proximity searches.
 * Typically rendered with a map picker in the UI.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'office_location',
 *   type: 'geolocation',
 *   required: true
 * }
 * ```
 */
export const GeolocationFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('geolocation'),
    })
  ),
  Schema.annotations({
    title: 'Geolocation Field',
    description:
      'Stores geographic coordinates (latitude and longitude). Used for location-based features.',
    examples: [
      {
        id: 1,
        name: 'office_location',
        type: 'geolocation',
        required: true,
      },
    ],
  })
)

export type GeolocationField = Schema.Schema.Type<typeof GeolocationFieldSchema>
