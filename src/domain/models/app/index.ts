/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthSchema } from './auth'
import { BlocksSchema } from './blocks'
import { DescriptionSchema } from './description'
import { LanguagesSchema } from './languages'
import { NameSchema } from './name'
import { LayoutSchema } from './page/layout'
import { PagesSchema } from './pages'
import { TablesSchema } from './tables'
import { ThemeSchema } from './theme'
import { VersionSchema } from './version'

/**
 * AppSchema defines the structure of an application configuration.
 *
 * This schema represents the core metadata for any application built
 * with Sovrium, including its name, optional version, and optional description.
 *
 * @example
 * ```typescript
 * const myApp = {
 *   name: 'todo-app',
 *   version: '1.0.0',
 *   description: 'A simple todo list application',
 * }
 *
 * const validated = Schema.decodeUnknownSync(AppSchema)(myApp)
 * ```
 */
export const AppSchema = Schema.Struct({
  /**
   * The name of the application.
   *
   * Must follow npm package naming conventions:
   * - Lowercase only
   * - Maximum 214 characters (including scope for scoped packages)
   * - Cannot start with a dot or underscore
   * - Cannot contain leading/trailing spaces
   * - Cannot contain non-URL-safe characters
   * - Scoped packages: @scope/package-name format allowed
   * - Can include hyphens and underscores (but not at the start)
   */
  name: NameSchema,

  /**
   * The version of the application (optional).
   *
   * Must follow Semantic Versioning (SemVer) 2.0.0 specification:
   * - Format: MAJOR.MINOR.PATCH (e.g., 1.0.0)
   * - No leading zeros in version components
   * - Optional pre-release identifiers (e.g., 1.0.0-alpha)
   * - Optional build metadata (e.g., 1.0.0+build.123)
   */
  version: Schema.optional(VersionSchema),

  /**
   * A description of the application (optional).
   *
   * Must be a single-line string:
   * - No line breaks allowed (\n, \r, or \r\n)
   * - No maximum length restriction
   * - Can contain any characters except line breaks
   * - Unicode characters and emojis are supported
   */
  description: Schema.optional(DescriptionSchema),

  /**
   * Data tables that define the data structure (optional).
   *
   * Collection of database tables that define the data structure of your application.
   * Each table represents an entity (e.g., users, products, orders) with fields that
   * define the schema. Tables support relationships, indexes, constraints, and various
   * field types.
   */
  tables: Schema.optional(TablesSchema),

  /**
   * Design system configuration (optional).
   *
   * Unified design tokens for colors, typography, spacing, animations, breakpoints,
   * shadows, and border radius. Theme applies globally to all pages via className
   * utilities and CSS variables.
   */
  theme: Schema.optional(ThemeSchema),

  /**
   * Multi-language support configuration (optional).
   *
   * Defines supported languages, default language, translations, and i18n behavior
   * (browser detection, persistence). Pages reference translations using $t: syntax.
   */
  languages: Schema.optional(LanguagesSchema),

  /**
   * Authentication configuration (optional).
   *
   * Enables authentication features including email/password authentication,
   * user management, and organization support. Configure authentication providers
   * and optional plugins (admin, organization) based on application requirements.
   */
  auth: Schema.optional(AuthSchema),

  /**
   * Reusable UI component blocks (optional).
   *
   * Array of reusable component templates with variable substitution. Blocks are
   * defined once at app level and referenced across pages using $ref syntax with
   * $vars for dynamic content.
   */
  blocks: Schema.optional(BlocksSchema),

  /**
   * Default layout configuration for all pages (optional).
   *
   * Defines the default layout components (banner, navigation, footer, sidebar) that
   * apply to all pages. Individual pages can:
   * - Override: Provide their own layout configuration
   * - Extend: Add components (e.g., sidebar) to the default layout
   * - Disable: Set layout to null to render without any layout components
   *
   * This enables consistent layout across pages with per-page customization flexibility.
   */
  defaultLayout: Schema.optional(LayoutSchema),

  /**
   * Marketing and content pages (optional).
   *
   * Array of page configurations with server-side rendering support. Pages use a
   * block-based layout system with comprehensive metadata, theming, and i18n support.
   * Minimum of 1 page required when pages property is present.
   */
  pages: Schema.optional(PagesSchema),
}).pipe(
  Schema.annotations({
    title: 'Application Configuration',
    description:
      'Complete application configuration including name, version, description, and data tables. This is the root schema for Sovrium applications.',
    examples: [
      {
        name: 'todo-app',
        version: '1.0.0',
        description: 'A simple todo list application',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' as const, required: true },
              { id: 2, name: 'completed', type: 'checkbox' as const, required: true },
            ],
          },
        ],
      },
      {
        name: '@myorg/dashboard',
        version: '2.0.0-beta.1',
        description: 'Admin dashboard for analytics and reporting',
      },
      {
        name: 'blog-system',
      },
    ],
  })
)

/**
 * TypeScript type inferred from AppSchema.
 *
 * Use this type for type-safe access to validated application data.
 *
 * @example
 * ```typescript
 * const app: App = {
 *   name: 'my-app',
 * }
 * ```
 */
export type App = Schema.Schema.Type<typeof AppSchema>

/**
 * Encoded type of AppSchema (what goes in).
 *
 * In this case, it's the same as App since we don't use transformations.
 */
export type AppEncoded = Schema.Schema.Encoded<typeof AppSchema>

// Re-export all domain model schemas and types for convenient imports
export * from './name'
export * from './version'
export * from './description'
export * from './tables'
export * from './theme'
export * from './languages'
export * from './auth'
export * from './blocks'
export * from './pages'
