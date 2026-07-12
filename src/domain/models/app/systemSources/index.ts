/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const SystemSourceNameSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^[a-z0-9][a-z0-9-]*$/),
  Schema.annotations({
    title: 'System Source Name',
    description: 'Reference name of a system-source catalog entry (lowercase kebab-case)',
    examples: ['runs', 'audit-log', 'global-search'],
  })
)

export type SystemSourceName = Schema.Schema.Type<typeof SystemSourceNameSchema>

export const SystemSourceSchema = Schema.Struct({
  name: SystemSourceNameSchema,
  endpoint: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Read endpoint path to fetch rows from (e.g. /api/admin/automations/runs)',
      examples: ['/api/admin/automations/runs', '/api/admin/search'],
    })
  ),
  rowsKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of the rows array in the response envelope (default: 'items')",
    })
  ),
  idKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of each row's unique id (default: 'id')",
    })
  ),
  totalKey: Schema.optional(
    Schema.String.annotations({
      description: 'Key of the total-count in the envelope; falls back to rows length if absent',
    })
  ),
  query: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
    }).annotations({
      description: 'Static query params merged into every request to the endpoint',
    })
  ),
}).annotations({
  identifier: 'SystemSource',
  title: 'System Source',
  description:
    'A named, reusable system read-endpoint declaration referenced by name via the { systemSource } shorthand',
})

export type SystemSource = Schema.Schema.Type<typeof SystemSourceSchema>

export const SystemSourceCatalogSchema = Schema.Array(SystemSourceSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    identifier: 'SystemSourceCatalog',
    title: 'System Source Catalog',
    description:
      'Named, reusable system read-endpoint declarations referenced by name via the { systemSource } shorthand',
  }),
  Schema.filter((sources) => {
    const names = sources.map((s) => s.name)
    return names.length === new Set(names).size || 'System source names must be unique'
  })
)

export type SystemSourceCatalog = Schema.Schema.Type<typeof SystemSourceCatalogSchema>

export const SystemSourceRefSchema = Schema.Struct({
  systemSource: SystemSourceNameSchema,
}).annotations({
  identifier: 'SystemSourceRef',
  title: 'System Source Reference',
  description: 'Bind a data component to a named app.systemSources entry by reference',
})

export type SystemSourceRef = Schema.Schema.Type<typeof SystemSourceRefSchema>


export const resolveSystemSource = (
  name: string,
  catalog: SystemSourceCatalog | undefined
): SystemSource | undefined => (catalog ?? []).find((entry) => entry.name === name)
