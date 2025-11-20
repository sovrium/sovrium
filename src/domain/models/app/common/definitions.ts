/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Unique positive integer identifier for entities
 *
 * IDs are system-generated, auto-incrementing, and immutable.
 * Must be unique within the parent collection (e.g., field IDs unique within a table).
 * IDs are read-only and assigned automatically when entities are created.
 *
 * Range: 1 to 9,007,199,254,740,991 (JavaScript MAX_SAFE_INTEGER)
 *
 * @example
 * ```typescript
 * const id = 1
 * const tableId = 100
 * const fieldId = 1000
 * ```
 *
 * @see specs/app/common/definitions.schema.json#/definitions/id
 */
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

/**
 * Internal identifier name used for database tables, columns, and programmatic references
 *
 * Must follow database naming conventions:
 * - Start with a letter
 * - Contain only lowercase letters, numbers, and underscores
 * - Maximum 63 characters (PostgreSQL limit)
 *
 * Used in SQL queries, API endpoints, and code generation.
 * Choose descriptive names that clearly indicate the purpose.
 *
 * @example
 * ```typescript
 * const name1 = 'user'
 * const name2 = 'email_address'
 * const name3 = 'created_at'
 * ```
 *
 * @see specs/app/common/definitions.schema.json#/definitions/name
 */
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

/**
 * URL path for routing and navigation
 *
 * Must:
 * - Start with forward slash (/)
 * - Contain only lowercase letters, numbers, hyphens, colons, and forward slashes
 * - Be descriptive and hierarchical
 * - Support dynamic route parameters with colon prefix (e.g., :id, :slug)
 *
 * Used for page routing, API endpoints, and navigation links.
 * Nested paths and dynamic parameters are supported for flexible routing.
 *
 * @example
 * ```typescript
 * const root = '/'
 * const simple = '/about'
 * const nested = '/products/inventory'
 * const kebabCase = '/our-team'
 * const dynamic = '/blog/:slug'
 * const multiParam = '/users/:userId/posts/:postId'
 * ```
 *
 * @see specs/app/common/definitions.schema.json#/definitions/path
 */
export const PathSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^\/[a-z0-9-_/:]*$/, {
    message: () =>
      'Path must start with / and contain only lowercase letters, numbers, hyphens, underscores, colons, and forward slashes',
  }),
  Schema.annotations({
    title: 'Path',
    description: 'URL path for routing and navigation (supports dynamic parameters with :param)',
    examples: [
      '/home',
      '/customers',
      '/products/inventory',
      '/admin/settings',
      '/reports/sales',
      '/blog/:slug',
      '/products/:id',
      '/users/:userId/posts/:postId',
    ],
  })
)

/**
 * Relative file path for local assets
 *
 * Must:
 * - Start with ./ or ../
 * - Be relative to current file or parent directory
 *
 * Used for referencing local assets like images, fonts, and stylesheets.
 * Relative paths are resolved at build time and work across different environments.
 *
 * @example
 * ```typescript
 * const logo = './public/logo.svg'
 * const image = '../images/hero.jpg'
 * const icon = './assets/icon.png'
 * ```
 *
 * @see specs/app/pages/common/definitions.schema.json#/definitions/relativePath
 */
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

/**
 * Hex color code (6-digit format)
 *
 * Validates hex color format: #RRGGBB
 * - Starts with #
 * - Followed by exactly 6 hex digits (0-9, A-F, case-insensitive)
 *
 * Used for:
 * - Banner background/text colors
 * - Safari mask-icon color attribute
 * - Theme color customization
 *
 * @example
 * ```typescript
 * const primary = '#007BFF'
 * const success = '#28A745'
 * const danger = '#DC3545'
 * const safariMask = '#5BBAD5'
 * ```
 *
 * @see specs/app/common/definitions.schema.json#/definitions/hexColor
 */
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
