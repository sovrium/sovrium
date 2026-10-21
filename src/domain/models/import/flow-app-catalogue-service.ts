/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading the observed-apps catalogue (`flow-app-catalogue-rows.ts`) for one
 * source step, and the two connections an import writes inline: a catalogue
 * entry's, and the skeleton of an app neither the library nor the catalogue
 * knows.
 *
 * The library always wins: these lookups are only consulted for a slug the
 * library does not hold, so an app promoted into the library is written from
 * there and its catalogue row is ignored until it is deleted.
 */

import { FLOW_APP_CATALOGUE } from './flow-app-catalogue-rows'
import { toKebabName } from './import-names-service'
import { normaliseZapierApp } from './zapier-step-mappings'
import type { FlowAppCatalogueEntry } from './flow-app-catalogue'
import type { AutomationSourceTool } from './flow-step-mappings'
import type { ConfigEntry } from './table-mapper-service'

/** The parameter names each operation declares, and those it cannot run without. */
export interface DeclaredParams {
  /** Every parameter name, by operation name. */
  readonly operations: Readonly<Record<string, readonly string[]>>
  /** The required parameters and those in the path, by operation name. */
  readonly required: Readonly<Record<string, readonly string[]>>
}

/** One declared parameter, read loosely: a built connection is untyped data. */
interface LooseParam {
  readonly required?: unknown
  readonly in?: unknown
}

const paramsOf = (operation: unknown): Readonly<Record<string, LooseParam>> => {
  const { params } = (operation ?? {}) as { readonly params?: unknown }
  return typeof params === 'object' && params !== null
    ? (params as Readonly<Record<string, LooseParam>>)
    : {}
}

const nameOf = (operation: unknown): string | undefined => {
  const { name } = (operation ?? {}) as { readonly name?: unknown }
  return typeof name === 'string' ? name : undefined
}

/** What each of `operations` declares, as a `connection/call` reads it. */
export const declaredParamsOf = (operations: readonly unknown[]): DeclaredParams => {
  const named = operations.flatMap((operation) => {
    const name = nameOf(operation)
    return name === undefined ? [] : [{ name, params: paramsOf(operation) }]
  })
  return {
    operations: Object.fromEntries(named.map(({ name, params }) => [name, Object.keys(params)])),
    required: Object.fromEntries(
      named.map(({ name, params }) => [
        name,
        Object.entries(params)
          .filter(([, param]) => param.required === true || param.in === 'path')
          .map(([param]) => param),
      ])
    ),
  }
}

/** The app as a catalogue row names it: a Zapier app compares without version or suffix. */
const sameApp = (tool: AutomationSourceTool, row: string, step: string): boolean =>
  tool === 'zapier' ? normaliseZapierApp(row) === normaliseZapierApp(step) : row === step

/** The catalogue entry the import writes as `slug`, if the catalogue holds one. */
export const catalogueEntryOf = (slug: string): FlowAppCatalogueEntry | undefined =>
  FLOW_APP_CATALOGUE.find((entry) => entry.slug === slug)

/** A catalogue entry and the action of it a source step or trigger runs. */
export interface CatalogueAction {
  readonly entry: FlowAppCatalogueEntry
  readonly action: FlowAppCatalogueEntry['actions'][number]
}

/** The catalogue action a source step (or trigger) of `tool` names, if any. */
export const catalogueActionOf = (
  tool: AutomationSourceTool,
  app: string,
  operation: string,
  kind: 'step' | 'trigger'
): CatalogueAction | undefined =>
  FLOW_APP_CATALOGUE.flatMap((entry) =>
    entry.actions
      .filter(
        (action) =>
          action.tool === tool &&
          action.kind === kind &&
          action.operation === operation &&
          sameApp(tool, action.app, app)
      )
      .map((action) => ({ entry, action }))
  )[0]

/** A catalogue entry as the `connections[]` entry named `name`, with every operation it declares. */
export const catalogueConnection = (entry: FlowAppCatalogueEntry, name: string): ConfigEntry => ({
  name,
  ...entry.connection,
  ...(entry.operations.length === 0 ? {} : { operations: entry.operations }),
})

/** The app's own name in a source step: `App25273CLIAPI@1.0.3` → `App25273`, `n8n-nodes-base.trello` → `trello`. */
export const appWordOf = (tool: AutomationSourceTool, app: string): string => {
  if (tool === 'zapier') return normaliseZapierApp(app)
  if (tool === 'make') return app.split(':')[0] ?? app
  return app.slice(app.lastIndexOf('.') + 1)
}

/** The skeleton connection's name for an app: the app's own name in kebab case. */
export const skeletonSlugOf = (tool: AutomationSourceTool, app: string): string =>
  toKebabName(appWordOf(tool, app), 'app')

/** The env names a skeleton reads: its base URL and its token. */
export const skeletonEnvOf = (slug: string): readonly [string, string] => {
  const stem = slug.toUpperCase().replaceAll('-', '_')
  return [`${stem}_BASE_URL`, `${stem}_TOKEN`]
}

/**
 * The skeleton of an app neither the library nor the catalogue knows: a
 * bearer connection whose base URL and token are both read from env names
 * derived from its slug, and which declares no operation.
 */
export const skeletonConnection = (slug: string, name: string): ConfigEntry => {
  const [baseUrl, token] = skeletonEnvOf(slug)
  return {
    name,
    type: 'bearer',
    label: slug,
    description: `The API behind the imported ${slug} steps; set its base URL and token, then rebuild each call`,
    props: { token: `$env.${token}` },
    baseUrl: `$env.${baseUrl}`,
  }
}
