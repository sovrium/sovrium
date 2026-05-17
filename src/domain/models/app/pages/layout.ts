/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema, DataSortSchema } from './components/data-source'

// ─── Layout Component ────────────────────────────────────────────────────────

/**
 * A component placed in a layout section (header, footer, etc.).
 *
 * Uses a tagged struct pattern on `type` for future extensibility.
 * Currently supports `notificationBell` with optional position.
 *
 * @example
 * ```typescript
 * { type: 'notificationBell', position: 'right' }
 * ```
 */
const LayoutComponentSchema = Schema.Struct({
  /** Component type identifier */
  type: Schema.Literal('notificationBell').pipe(
    Schema.annotations({ description: 'Layout component type' })
  ),

  /** Position of the component within its layout section */
  position: Schema.optional(
    Schema.Literal('left', 'right').pipe(
      Schema.annotations({
        description: 'Position of the component in the layout section (default: right)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'LayoutComponent',
    title: 'Layout Component',
    description: 'A component placed in a layout section (header, footer, etc.)',
  })
)

/** @public */
export type LayoutComponent = Schema.Schema.Type<typeof LayoutComponentSchema>

// ─── Layout Section ──────────────────────────────────────────────────────────

/**
 * A named layout section containing components.
 *
 * @example
 * ```typescript
 * { components: [{ type: 'notificationBell', position: 'right' }] }
 * ```
 */
const LayoutSectionSchema = Schema.Struct({
  /** Components rendered in this layout section */
  components: Schema.Array(LayoutComponentSchema).pipe(
    Schema.annotations({
      description: 'Components rendered in this layout section',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'LayoutSection',
    title: 'Layout Section',
    description: 'A named layout section containing components',
  })
)

/** @public */
export type LayoutSection = Schema.Schema.Type<typeof LayoutSectionSchema>

// ─── Sidebar Item ────────────────────────────────────────────────────────────

/**
 * Sidebar template — defines how each record in the sidebar's `dataSource`
 * is rendered as a navigation entry.
 *
 * The template is intentionally generic (label / href) so the same shape
 * works for any access-gated table. `archivedField` lets the sidebar hide
 * records flagged with a per-record archive boolean.
 *
 * @example
 * ```typescript
 * {
 *   label: '$record.name',
 *   href: '/portal/projects/$record.id',
 *   archivedField: 'archived',
 * }
 * ```
 */
const SidebarTemplateSchema = Schema.Struct({
  /** Label expression — `$record.<field>` substitutions are resolved per-row. */
  label: Schema.String.pipe(
    Schema.annotations({
      description: 'Label expression for each entry. Supports $record.<field> substitution.',
    })
  ),
  /** Href expression — `$record.<field>` substitutions are resolved per-row. */
  href: Schema.String.pipe(
    Schema.annotations({
      description: 'Anchor href for each entry. Supports $record.<field> substitution.',
    })
  ),
  /**
   * Optional record-level archive flag. When set, sidebar entries whose
   * record has a truthy value in this field are hidden. Independent of
   * the engine's soft-delete column (`deleted_at`).
   */
  archivedField: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Field name whose truthy value hides the entry from the sidebar.',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'SidebarTemplate',
    title: 'Sidebar Template',
    description: 'Per-record rendering template for sidebar navigation entries',
  })
)

/** @public */
export type SidebarTemplate = Schema.Schema.Type<typeof SidebarTemplateSchema>

/**
 * Lightweight data-source binding for sidebar entries — only the fields
 * the sidebar actually consumes (table / filter / sort). The full
 * `DataSourceSchema` includes pagination/search modes that don't apply
 * to navigation, so the sidebar declares its own subset.
 */
const SidebarDataSourceSchema = Schema.Struct({
  /** Table name to query (must exist in app.tables) */
  table: Schema.String.pipe(
    Schema.annotations({
      description: 'Table name to bind to (validated against app.tables)',
    })
  ),
  /** Optional filters — typically `$currentUser.assignments.<table>` for scoped sidebars. */
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).pipe(
      Schema.annotations({ description: 'Filter conditions applied before rendering entries.' })
    )
  ),
  /** Optional sort rules. */
  sort: Schema.optional(
    Schema.Array(DataSortSchema).pipe(
      Schema.annotations({ description: 'Sort rules applied to the resulting entries.' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'SidebarDataSource',
    title: 'Sidebar Data Source',
    description: 'Data source binding for sidebar entries (table + filter + sort)',
  })
)

/** @public */
export type SidebarDataSource = Schema.Schema.Type<typeof SidebarDataSourceSchema>

/**
 * A single sidebar section bound to a table.
 *
 * Each entry maps directly onto an `<a>` element rendered inside the
 * page's `<aside>`. The `dataSource` query is resolved server-side at
 * render time; combined with `$currentUser.assignments` filters, this
 * produces a per-user scoped navigation list.
 *
 * @example
 * ```typescript
 * {
 *   dataSource: {
 *     table: 'projects',
 *     filter: [{ field: 'id', operator: 'in', value: '$currentUser.assignments.projects' }],
 *     sort: [{ field: 'name', direction: 'asc' }],
 *   },
 *   template: {
 *     label: '$record.name',
 *     href: '/portal/projects/$record.id',
 *     archivedField: 'archived',
 *   },
 *   activeIndicator: '$currentUser.activeAssignment',
 * }
 * ```
 */
const SidebarItemSchema = Schema.Struct({
  /** Data source describing what records render as sidebar entries. */
  dataSource: SidebarDataSourceSchema,
  /** Per-record rendering template. */
  template: SidebarTemplateSchema,
  /**
   * Optional active-indicator expression. Currently supports
   * `$currentUser.activeAssignment` (resolves the active-scope cookie
   * for the matching scope-table). Entries whose record id matches the
   * resolved value get `data-active="true"` for styling/testing.
   */
  activeIndicator: Schema.optional(
    Schema.Literal('$currentUser.activeAssignment').pipe(
      Schema.annotations({
        description:
          'Expression that resolves to the recordId currently considered "active". Marks the matching entry with data-active="true".',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'SidebarItem',
    title: 'Sidebar Item',
    description: 'A sidebar section bound to a table for scoped navigation',
  })
)

export type SidebarItem = Schema.Schema.Type<typeof SidebarItemSchema>

// ─── Page Layout ─────────────────────────────────────────────────────────────

/**
 * Layout configuration with named sections.
 *
 * Defines the structural layout of a page with optional sections
 * (header, footer, sidebar) each containing their own components.
 *
 * @example
 * ```typescript
 * {
 *   header: {
 *     components: [{ type: 'notificationBell', position: 'right' }]
 *   }
 * }
 * ```
 */
export const PageLayoutSchema = Schema.Struct({
  /** Header section with components */
  header: Schema.optional(LayoutSectionSchema),

  /**
   * Sidebar — array of data-bound navigation sections.
   *
   * Each item declares its own `dataSource` and per-record `template`.
   * The engine resolves filters server-side (notably
   * `$currentUser.assignments.<table>` for scoped sidebars), so the
   * resulting markup contains exactly the records the user should see.
   */
  sidebar: Schema.optional(
    Schema.Array(SidebarItemSchema).pipe(
      Schema.annotations({
        description: 'Data-bound navigation sections rendered inside the page <aside>',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'PageLayout',
    title: 'Page Layout',
    description: 'Layout configuration with named sections (header, footer, sidebar)',
  })
)

/** @public */
export type PageLayout = Schema.Schema.Type<typeof PageLayoutSchema>
