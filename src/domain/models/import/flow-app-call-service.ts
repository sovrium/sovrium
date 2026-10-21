/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where an app step lands, and the action it becomes there.
 *
 * In order, the first that applies:
 *
 * 1. **The registry row names a library connection and operation**, and the
 *    library holds them (built in, or in its generated operation set): a
 *    `connection/call` of the library's connection.
 * 2. **The row, or the step's action, names the observed-apps catalogue**,
 *    for an app the library does not hold: a `connection/call` of the
 *    catalogue's connection, or an `http/request` on it when the catalogue
 *    knows the app but not the endpoint.
 * 3. **A step of an app neither knows that runs on a source credential** (a
 *    private Zapier integration): an `http/request` on a bearer skeleton named
 *    after the app.
 *
 * A required or path parameter the step does not give is written
 * `{{todo.<name>}}`, and the step's TODO names each one; an address the import
 * cannot know is placeholders too. Nothing is invented.
 */

import { addressForAccount } from '@/domain/models/app/connections/connection-env-service'
import { quoteOriginal } from './credential-redaction-service'
import {
  catalogueActionOf,
  catalogueEntryOf,
  declaredParamsOf,
  skeletonEnvOf,
  skeletonSlugOf,
  type DeclaredParams,
} from './flow-app-catalogue-service'
import { render } from './flow-expression-service'
import { sourceStepPhrase } from './source-display-name-service'
import type { CanonicalStep } from './canonical-flow'
import type { RenderContext } from './flow-expression-service'
import type { AutomationSourceTool, StepMapping } from './flow-step-mappings'
import type { StepOutcome } from './flow-step-service'
import type { ConfigEntry } from './table-mapper-service'

/** A library connection, as the CLI reads it from the catalogue for the mapper. */
export interface LibraryConnection {
  /** The env NAMES its fragment reads. */
  readonly env: readonly string[]
  /**
   * The parameter names of every operation it can declare, by operation name:
   * the ones its entry builds and the ones of its generated operation set.
   */
  readonly operations: Readonly<Record<string, readonly string[]>>
  /** The parameters each operation cannot run without (required, or in its path). */
  readonly required?: Readonly<Record<string, readonly string[]>>
  /** The operations its entry builds; absent, every one of `operations`. */
  readonly built?: readonly string[]
  /**
   * The `connections[]` entry named `name`, as `sovrium library add` writes it,
   * with each of `extra` (an operation of the generated set it does not build)
   * appended as `sovrium library add <slug>/<operation>` appends it.
   */
  readonly entry: (name: string, extra: readonly string[]) => ConfigEntry
  /** For an OAuth connection, where the operator registers the OAuth application. */
  readonly oauthApp?: string
}

/** Where a connection's definition comes from. */
export type ConnectionOrigin = 'library' | 'catalogue' | 'skeleton'

/** A connection one step or trigger needs. */
export interface ConnectionCall {
  readonly origin: ConnectionOrigin
  readonly slug: string
  /** The operation it calls or registers with; absent for an http request on it. */
  readonly operation?: string
  /** The source credential it runs with, as the adapter labels it. */
  readonly credential?: string
}

/** Where an app step lands. */
export type AppCall =
  | {
      readonly kind: 'call'
      readonly need: ConnectionCall & { readonly operation: string }
      readonly params: Readonly<Record<string, unknown>>
      readonly missing: readonly string[]
    }
  | {
      readonly kind: 'http'
      readonly need: ConnectionCall
      readonly method: string
      readonly url: string
      /** Why, naming the connection by the name it was given in `connections[]`. */
      readonly reason: (connection: string) => string
    }

/** What resolving an app step reads. */
export interface AppCallTarget {
  readonly name: string
  readonly tool: AutomationSourceTool
  readonly connection: (slug: string) => LibraryConnection | undefined
  /** The `connections[]` name a connection need was given; absent, its slug. */
  readonly connectionName?: (need: ConnectionCall) => string
  readonly rendering: RenderContext
}

type AppStep = Extract<CanonicalStep, { readonly kind: 'app-action' }>

const NON_PARAMS = new Set(['resource', 'operation', 'authentication', 'options'])

const credentialOf = (step: AppStep) =>
  step.credential === undefined ? {} : { credential: step.credential }

/** A call of `operation`, carrying the inputs it declares and naming the required ones absent. */
const callOf = (
  step: AppStep,
  need: { readonly origin: ConnectionOrigin; readonly slug: string; readonly operation: string },
  declared: DeclaredParams
): AppCall | undefined => {
  const names = declared.operations[need.operation]
  if (names === undefined) return undefined
  const params = Object.fromEntries(
    Object.entries(step.inputs).filter(([key]) => !NON_PARAMS.has(key) && names.includes(key))
  )
  const missing = (declared.required[need.operation] ?? []).filter((name) => !(name in params))
  return { kind: 'call', need: { ...need, ...credentialOf(step) }, params, missing }
}

const libraryParams = (library: LibraryConnection): DeclaredParams => ({
  operations: library.operations,
  required: library.required ?? {},
})

/** A registry row naming a connection: the library's, else the catalogue's of that slug. */
const rowCall = (step: AppStep, row: StepMapping | undefined, target: AppCallTarget) => {
  if (row?.target.kind !== 'connection') return undefined
  const { connection: slug, operation } = row.target
  const library = target.connection(slug)
  if (library !== undefined)
    return callOf(step, { origin: 'library', slug, operation }, libraryParams(library))
  const entry = catalogueEntryOf(slug)
  return entry === undefined
    ? undefined
    : callOf(step, { origin: 'catalogue', slug, operation }, declaredParamsOf(entry.operations))
}

/** A step the catalogue names by its action, for an app the library does not hold. */
const catalogueCall = (step: AppStep, target: AppCallTarget): AppCall | undefined => {
  const found = catalogueActionOf(target.tool, step.app, step.operation, 'step')
  if (found === undefined || target.connection(found.entry.slug) !== undefined) return undefined
  const { entry, action } = found
  const need = { origin: 'catalogue' as const, slug: entry.slug }
  if (action.calls !== undefined)
    return callOf(step, { ...need, operation: action.calls }, declaredParamsOf(entry.operations))
  const baseUrl = typeof entry.connection['baseUrl'] === 'string' ? entry.connection['baseUrl'] : ''
  return {
    kind: 'http',
    need: { ...need, ...credentialOf(step) },
    method: '{{todo.method}}',
    url: `${baseUrl}{{todo.path}}`,
    reason: () => `${action.unknown ?? 'The endpoint behind this action is not known'}.`,
  }
}

/** A step of an app neither the library nor the catalogue knows, on its source credential. */
const skeletonCall = (step: AppStep, target: AppCallTarget): AppCall | undefined => {
  if (step.credential === undefined) return undefined
  const slug = skeletonSlugOf(target.tool, step.app)
  const [baseUrl] = skeletonEnvOf(slug)
  return {
    kind: 'http',
    need: { origin: 'skeleton', slug, ...credentialOf(step) },
    method: '{{todo.method}}',
    url: `$env.${baseUrl}{{todo.path}}`,
    reason: (connection) =>
      `The app of ${sourceStepPhrase(target.tool, step.app, step.operation)} is neither in the connection library nor in the import's catalogue, and its operations are not public, so the step is an http request on the ${connection} connection: set its base URL and token, then the method and path it calls.`,
  }
}

/** Where an app step lands, or `undefined` when nothing knows its app. */
export const resolveAppCall = (
  step: AppStep,
  row: StepMapping | undefined,
  target: AppCallTarget
): AppCall | undefined =>
  rowCall(step, row, target) ?? catalogueCall(step, target) ?? skeletonCall(step, target)

/**
 * Where an app call lands, in the words a report uses, naming the connection
 * by its name in `connections[]` (`apify-2` for a second account), not its app.
 */
export const appCallWords = (call: AppCall, connection: string = call.need.slug): string =>
  call.kind === 'call'
    ? `the ${connection} connection's ${call.need.operation}`
    : `an http request on the ${connection} connection`

/** `{{todo.<name>}}`, the name made an identifier. */
export const todoPlaceholder = (name: string): string =>
  `{{todo.${name.replace(/[^A-Za-z0-9_]/g, '_')}}}`

const listed = (names: readonly string[]): string => names.map((name) => `\`${name}\``).join(', ')

/** The placeholders a request address holds, by name. */
const placeholdersIn = (...values: readonly string[]): readonly string[] =>
  [...values.join(' ').matchAll(/\{\{todo\.([A-Za-z0-9_]+)\}\}/g)].map((match) => match[1] ?? '')

/** An app step as the action its call lands on, and the TODO it carries. */
export const appCallOutcome = (
  step: AppStep,
  call: AppCall,
  target: AppCallTarget
): StepOutcome => {
  const connection = target.connectionName?.(call.need) ?? call.need.slug
  const original = quoteOriginal({ app: step.app, operation: step.operation, inputs: step.inputs })
  if (call.kind === 'http') {
    return {
      action: {
        name: target.name,
        type: 'http',
        operator: 'request',
        props: {
          connection,
          method: call.method,
          url: addressForAccount(call.need.slug, connection, call.url),
        },
      },
      todo: {
        original,
        reason: `${call.reason(connection)} Set ${listed(placeholdersIn(call.method, call.url))} by hand, and the body if it sends one.`,
      },
      connection: call.need,
    }
  }
  const placeholders = Object.fromEntries(call.missing.map((name) => [name, todoPlaceholder(name)]))
  const params = { ...(render(call.params, target.rendering) as object), ...placeholders }
  return {
    action: {
      name: target.name,
      type: 'connection',
      operator: 'call',
      props: { connection, operation: call.need.operation, params },
    },
    ...(call.missing.length === 0
      ? {}
      : {
          todo: {
            original,
            reason: `${sourceStepPhrase(target.tool, step.app, step.operation)} maps to ${appCallWords(call, connection)}, which needs ${listed(call.missing)}; the step does not give ${call.missing.length === 1 ? 'it' : 'them'} in a form the import reads, so each is a {{todo.<name>}} placeholder to set by hand.`,
          },
        }),
    connection: call.need,
  }
}
