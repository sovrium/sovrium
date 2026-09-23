/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Named system-source catalog (CAP-4)
// ---------------------------------------------------------------------------

/**
 * The reference name of a catalog entry, used by the `{ systemSource: <name> }`
 * shorthand binding to point at a declared `app.systemSources[]` entry.
 *
 * Lowercase kebab-case identifiers keep config files readable and a reference
 * unambiguous: `dataSource: { systemSource: runs }` resolves to the entry named
 * `runs`. A name must start with an alphanumeric and may contain hyphens.
 */
export const SystemSourceNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'System Source Name',
    description: 'Reference name of a system-source catalog entry (lowercase kebab-case)',
    examples: ['runs', 'audit-log', 'global-search'],
  }),
  Schema.check(Schema.isMinLength(1), Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/))
)

/** @public Forward-prep for CAP-4: consumed when `{ systemSource: <name> }` interpreter resolution is wired. */
export type SystemSourceName = Schema.Schema.Type<typeof SystemSourceNameSchema>

/**
 * A single named system-source catalog entry.
 *
 * The rows-envelope shape mirrors the per-component `DataTableSystemSourceSchema`
 * (`endpoint`, `rowsKey?`, `idKey?`, `totalKey?`, `query?`) so a catalog entry is
 * a drop-in for the inline `{ system: { endpoint, ... } }` form — a referencing
 * component resolves `{ systemSource: <name> }` to the entry and reads the exact
 * same fields it would have read inline. Declaring the source ONCE here, then
 * referencing it by name, decouples the app config from raw REST paths and lets
 * `sovrium validate` check (offline) that every reference points at a declared
 * source.
 *
 * @example
 * ```yaml
 * systemSources:
 *   - name: runs
 *     endpoint: /api/admin/automations/runs
 *     rowsKey: items        # default 'items'
 *     idKey: id             # default 'id'
 *     totalKey: total       # optional; falls back to rows length
 *   - name: failed-runs
 *     endpoint: /api/admin/automations/runs
 *     query:                # STATIC params merged into every request
 *       status: failed
 * ```
 */
export const SystemSourceSchema = Schema.Struct({
  /** Reference name used by `{ systemSource: <name> }` (unique within the catalog) */
  name: SystemSourceNameSchema,
  /** The read endpoint to fetch rows from (required) */
  endpoint: Schema.String.pipe(
    Schema.annotate({
      description: 'Read endpoint path to fetch rows from (e.g. /api/admin/automations/runs)',
      examples: ['/api/admin/automations/runs', '/api/admin/search'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Array key in the response envelope (default: 'items') */
  rowsKey: Schema.optional(
    Schema.String.annotate({
      defaultNote: 'items',
      description: "Key of the rows array in the response envelope (default: 'items')",
    })
  ),
  /** Row id key used to identify rows (default: 'id') */
  idKey: Schema.optional(
    Schema.String.annotate({
      defaultNote: 'id',
      description: "Key of each row's unique id (default: 'id')",
    })
  ),
  /** Optional total-count key; falls back to rows length when absent */
  totalKey: Schema.optional(
    Schema.String.annotate({
      description: 'Key of the total-count in the envelope; falls back to rows length if absent',
    })
  ),
  /** Static query params merged into every request to the endpoint */
  query: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    ).annotate({
      description: 'Static query params merged into every request to the endpoint',
    })
  ),
}).annotate({
  identifier: 'SystemSource',
  title: 'System Source',
  description:
    'A named, reusable system read-endpoint declaration referenced by name via the { systemSource } shorthand',
})

/** @public Forward-prep for CAP-4: consumed when the catalog entry resolves to a per-component system binding. */
export type SystemSource = Schema.Schema.Type<typeof SystemSourceSchema>

/**
 * `app.systemSources` — the named system-source catalog.
 *
 * When present it must declare at least one source, and every `name` must be
 * unique (a duplicate name would make a `{ systemSource: <name> }` reference
 * ambiguous). Both constraints are enforced at decode time, so `sovrium validate`
 * rejects a duplicate-name catalog offline.
 */
export const SystemSourceCatalogSchema = Schema.Array(SystemSourceSchema).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
    identifier: 'SystemSourceCatalog',
    title: 'System Source Catalog',
    description:
      'Named, reusable system read-endpoint declarations referenced by name via the { systemSource } shorthand',
  }),
  Schema.check(
    Schema.makeFilter((sources) => {
      const names = sources.map((s) => s.name)
      return names.length === new Set(names).size || 'System source names must be unique'
    })
  )
)

/** @public Forward-prep for CAP-4: consumed when the interpreter reads `app.systemSources` to resolve references. */
export type SystemSourceCatalog = Schema.Schema.Type<typeof SystemSourceCatalogSchema>

/**
 * The `{ systemSource: <name> }` shorthand binding.
 *
 * A data component's `dataSource` may use this in place of the inline
 * `{ system: { endpoint, ... } }` form to bind to a named `app.systemSources[]`
 * entry by reference. The referenced name must resolve to a declared catalog
 * entry — `validateAllSystemSourceReferences` checks this at decode time, so an
 * unknown reference fails `sovrium validate` offline.
 *
 * @example
 * ```yaml
 * # instead of inline:  dataSource: { system: { endpoint: /api/admin/automations/runs } }
 * dataSource:
 *   systemSource: runs   # resolves to app.systemSources[] entry named 'runs'
 * ```
 */
export const SystemSourceRefSchema = Schema.Struct({
  /** Name of the catalog entry to bind to (validated against app.systemSources) */
  systemSource: SystemSourceNameSchema,
}).annotate({
  identifier: 'SystemSourceRef',
  title: 'System Source Reference',
  description: 'Bind a data component to a named app.systemSources entry by reference',
})

/** @public Forward-prep for CAP-4: consumed when the `{ systemSource }` shorthand is resolved at interpret time. */
export type SystemSourceRef = Schema.Schema.Type<typeof SystemSourceRefSchema>

// ---------------------------------------------------------------------------
// Reference resolution (CAP-4)
// ---------------------------------------------------------------------------

/**
 * Resolve a `{ systemSource: <name> }` reference to its declared catalog entry.
 *
 * A pure lookup over `app.systemSources` by name — the runtime counterpart to
 * the decode-time `validateAllSystemSourceReferences` cross-check. The
 * interpreter calls this at SSR island-props build time to DESUGAR the
 * `{ systemSource }` shorthand into the inline `{ system: <entry> }` form: the
 * resolved entry (minus its `name`) is a drop-in for the inline system binding,
 * so a referencing component behaves EXACTLY like one authored inline, and
 * `app.systemSources` never has to reach the client bundle.
 *
 * Returns the matching entry, or `undefined` when the name is not declared. An
 * undeclared reference is already rejected at decode (boot fails before serving),
 * so at runtime `undefined` only arises for a catalog-less app — callers leave
 * such a reference unchanged.
 */
export const resolveSystemSource = (
  name: string,
  catalog: SystemSourceCatalog | undefined
): SystemSource | undefined => (catalog ?? []).find((entry) => entry.name === name)
