/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const IdSchema = Schema.Int.pipe(
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(9_007_199_254_740_991),
  Schema.annotations({
    title: 'ID',
    description: 'Unique positive integer identifier for entities',
    examples: [1, 2, 3, 100, 1000],
    readOnly: true,
  })
)

export const NameSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(63),
  Schema.pattern(/^[a-z][a-z0-9_]*$/, {
    message: () =>
      'Name must start with a lowercase letter and contain only lowercase letters, numbers, and underscores (snake_case)',
  }),
  Schema.annotations({
    title: 'Name',
    description:
      'Internal identifier name for database tables, columns, and programmatic references',
    examples: ['user', 'product', 'order_item', 'customer_email', 'shipping_address', 'created_at'],
  })
)

export const PathSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^\/[a-z0-9-_/:*]*$/, {
    message: () =>
      'Path must start with / and contain only lowercase letters, numbers, hyphens, underscores, colons, asterisks, and forward slashes',
  }),
  Schema.annotations({
    title: 'Path',
    description:
      'URL path for routing and navigation (supports dynamic parameters with :param and trailing wildcards with *)',
    examples: [
      '/home',
      '/customers',
      '/products/inventory',
      '/admin/settings',
      '/reports/sales',
      '/blog/:slug',
      '/products/:id',
      '/users/:userId/posts/:postId',
      '/portal/*',
    ],
  })
)

export const RelativePathSchema = Schema.String.pipe(
  Schema.pattern(/^\.{1,2}\//, {
    message: () => 'Relative path must start with ./ or ../',
  }),
  Schema.annotations({
    title: 'Relative Path',
    description: 'Relative file path for local assets',
    examples: ['./public/logo.svg', '../images/hero.jpg', './assets/icon.png'],
  })
)

export const HexColorSchema = Schema.String.pipe(
  Schema.pattern(/^#[0-9A-Fa-f]{6}$/, {
    message: () => 'Color must be a 6-digit hex code (e.g., #007BFF, #5BBAD5)',
  }),
  Schema.annotations({
    title: 'Hex Color',
    description: 'Hex color code in #RRGGBB format',
    examples: ['#007BFF', '#28A745', '#DC3545', '#5BBAD5'],
  })
)

export type Id = Schema.Schema.Type<typeof IdSchema>
export type Name = Schema.Schema.Type<typeof NameSchema>
export type Path = Schema.Schema.Type<typeof PathSchema>
export type RelativePath = Schema.Schema.Type<typeof RelativePathSchema>
export type HexColor = Schema.Schema.Type<typeof HexColorSchema>
