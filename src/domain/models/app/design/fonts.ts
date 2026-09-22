/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Font weight (100-900 in increments of 100)
 */
export const FontWeightSchema = Schema.Literals([100, 200, 300, 400, 500, 600, 700, 800, 900]).pipe(
  Schema.annotate({
    title: 'Font Weight',
    description: 'Font weight value (100-900 in increments of 100)',
  })
)

/**
 * Font style (normal, italic, oblique)
 */
export const FontStyleSchema = Schema.Literals(['normal', 'italic', 'oblique']).pipe(
  Schema.annotate({
    title: 'Font Style',
    description: 'Font style',
  })
)

/**
 * Text transformation (none, uppercase, lowercase, capitalize)
 */
export const FontTransformSchema = Schema.Literals([
  'none',
  'uppercase',
  'lowercase',
  'capitalize',
]).pipe(
  Schema.annotate({
    title: 'Text Transform',
    description: 'Text transformation',
  })
)

/**
 * Font category name (alphabetic characters only: title, body, mono, etc.)
 */
export const FontCategoryKeySchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-zA-Z]+$/, {
      message: 'Font category key must contain only alphabetic characters (a-zA-Z)',
    })
  ),
  Schema.annotate({
    title: 'Font Category Key',
    description: 'Semantic font category name (alphabetic characters only)',
    examples: ['title', 'body', 'mono', 'heading', 'label'],
  })
)

/**
 * Individual font configuration (family, fallback, weights, style, size, lineHeight, letterSpacing, transform, url)
 *
 */
export const FontConfigItemSchema = Schema.Struct({
  family: Schema.String.pipe(
    Schema.annotate({
      title: 'Font Family',
      description: 'Primary font family name',
    })
  ),
  fallback: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Fallback Font Stack',
        description: 'Fallback font stack',
        examples: ['system-ui, sans-serif', 'Georgia, serif', 'monospace'],
      })
    )
  ),
  weights: Schema.optional(
    Schema.Array(FontWeightSchema).pipe(
      Schema.annotate({
        title: 'Font Weights',
        description: 'Available font weights',
        examples: [
          [400, 700],
          [300, 400, 500, 600, 700],
        ],
      })
    )
  ),
  style: Schema.optional(
    FontStyleSchema.pipe(
      Schema.annotate({
        default: 'normal',
      })
    )
  ),
  size: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Font Size',
        description: 'Default font size',
        examples: ['16px', '1rem', '14px'],
      })
    )
  ),
  lineHeight: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Line Height',
        description: 'Default line height',
        examples: ['1.5', '1.75', '24px'],
      })
    )
  ),
  letterSpacing: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Letter Spacing',
        description: 'Letter spacing',
        examples: ['0', '0.05em', '-0.01em'],
      })
    )
  ),
  transform: Schema.optional(FontTransformSchema),
  url: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Font URL',
        description: 'Font file URL or Google Fonts URL',
        examples: ['https://fonts.googleapis.com/css2?family=Inter', '/fonts/bely-display.woff2'],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'Font Configuration Item',
    description: 'Individual font configuration with family and optional properties',
  })
)

/**
 * Font configuration (map of semantic font categories to font configurations)
 *
 */
export const FontsConfigSchema = Schema.Record(FontCategoryKeySchema, FontConfigItemSchema).pipe(
  Schema.annotate({
    title: 'Font Configuration',
    description: 'Typography design tokens for font families and styles',
  })
)

// Type exports
/** @public */
export type FontWeight = Schema.Schema.Type<typeof FontWeightSchema>
/** @public */
export type FontStyle = Schema.Schema.Type<typeof FontStyleSchema>
/** @public */
export type FontTransform = Schema.Schema.Type<typeof FontTransformSchema>
/** @public */
export type FontCategoryKey = Schema.Schema.Type<typeof FontCategoryKeySchema>
/** @public */
export type FontConfigItem = Schema.Schema.Type<typeof FontConfigItemSchema>
export type FontsConfig = Schema.Schema.Type<typeof FontsConfigSchema>
