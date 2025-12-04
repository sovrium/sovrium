/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Barcode Field
 *
 * Stores barcode values with support for various barcode formats.
 * Used for product identification, inventory tracking, and asset management.
 * Can be configured to support specific barcode standards (e.g., EAN, UPC, QR Code).
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'product_barcode',
 *   type: 'barcode',
 *   required: true,
 *   format: 'EAN-13'
 * }
 * ```
 */
export const BarcodeFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('barcode'),
      format: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Barcode format',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Barcode Field',
    description:
      'Stores barcode values with various format support. Used for product identification and inventory.',
    examples: [
      {
        id: 1,
        name: 'product_barcode',
        type: 'barcode',
        required: true,
        format: 'EAN-13',
      },
    ],
  })
)

export type BarcodeField = Schema.Schema.Type<typeof BarcodeFieldSchema>
