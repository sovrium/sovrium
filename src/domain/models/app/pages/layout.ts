/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema, DataSortSchema } from './components/data-source'


const SidebarTemplateSchema = Schema.Struct({
  label: Schema.String.pipe(
    Schema.annotations({
      description: 'Label expression for each entry. Supports $record.<field> substitution.',
    })
  ),
  href: Schema.String.pipe(
    Schema.annotations({
      description: 'Anchor href for each entry. Supports $record.<field> substitution.',
    })
  ),
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

export type SidebarTemplate = Schema.Schema.Type<typeof SidebarTemplateSchema>

const SidebarDataSourceSchema = Schema.Struct({
  table: Schema.String.pipe(
    Schema.annotations({
      description: 'Table name to bind to (validated against app.tables)',
    })
  ),
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).pipe(
      Schema.annotations({ description: 'Filter conditions applied before rendering entries.' })
    )
  ),
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

export type SidebarDataSource = Schema.Schema.Type<typeof SidebarDataSourceSchema>

const SidebarItemSchema = Schema.Struct({
  dataSource: SidebarDataSourceSchema,
  template: SidebarTemplateSchema,
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


export const PageLayoutSchema = Schema.Struct({
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
    description: 'Layout configuration with named sections (sidebar)',
  })
)

export type PageLayout = Schema.Schema.Type<typeof PageLayoutSchema>
