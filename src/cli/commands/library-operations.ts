/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The API operations half of `sovrium library`: which operations an
 * `add <provider>/<operation>`, `add <provider> --tag <group>` or
 * `add <provider> --all` names, `show <provider>/<operation>`, and the
 * operation hits `search` prints below the catalogue's.
 *
 * ─── THE SETS ARE LOADED INSIDE THE HANDLER ────────────────────────────────
 *
 * For the catalogue's reason: `src/cli/index.ts` imports every command
 * eagerly, so the operation-set module is reached through `await import()` and
 * nowhere else here. The only static imports of `src/library/` are types.
 *
 * ─── AN ID IS AN OPERATION WHEN ITS FIRST SEGMENT IS NOT A KIND ────────────
 *
 * `connection/lemlist` and `lemlist/get-campaigns` share one shape. The first
 * segment of a catalogue id is always a kind (`block`, `connection`,
 * `recipe`), and no provider is named after one, so the kind decides.
 */

import { printStderr } from '@/infrastructure/logging/cli-output'
import type { OperationsRequest } from './library-add-operations'
import type {
  ConnectionOperation,
  OperationParam,
} from '@/domain/models/app/connections/operations'
import type { LibraryOperationSet } from '@/library/manifest/operations'

/** Above this many, `--all` installs only with `--yes`. */
const ALL_CONFIRMATION_THRESHOLD = 50

/** Stop with a refusal on stderr and exit 1. */
const refuse = (message: string): never => {
  printStderr(message)
  process.exit(1)
}

/** The operation-set module, loaded on demand. */
interface OperationsModule {
  readonly providers: readonly string[]
  readonly load: (provider: string) => Promise<LibraryOperationSet | undefined>
  readonly parse: (id: string) => { readonly provider: string; readonly name: string } | undefined
}

export const loadOperationsModule = async (): Promise<OperationsModule> => {
  const { OPERATION_PROVIDERS, loadOperationSet, parseOperationId } =
    await import('@/library/manifest/operations')
  return { providers: OPERATION_PROVIDERS, load: loadOperationSet, parse: parseOperationId }
}

/** Every provider's set, in provider order. */
export const loadAllOperationSets = async (
  operations: OperationsModule
): Promise<readonly LibraryOperationSet[]> =>
  (
    await Promise.all(operations.providers.map(async (provider) => operations.load(provider)))
  ).filter((set): set is LibraryOperationSet => set !== undefined)

/** Whether `id` names an operation rather than a catalogue entry. */
export const isOperationId = (id: string | undefined, kinds: readonly string[]): boolean => {
  const [first, second] = (id ?? '').split('/')
  return second !== undefined && first !== undefined && !kinds.includes(first)
}

/** The set a provider ships, or a refusal listing the providers that ship one. */
const setOrRefuse = async (
  operations: OperationsModule,
  provider: string
): Promise<LibraryOperationSet> =>
  (await operations.load(provider)) ??
  refuse(
    `Error: The library ships no API operations for "${provider}".\n\n` +
      `  Providers with operations: ${operations.providers.join(', ')}.\n` +
      '  Find one with `sovrium library search <word>`.'
  )

/** One operation of a set, or a refusal pointing at the search that finds it. */
const operationOrRefuse = (set: LibraryOperationSet, name: string): ConnectionOperation =>
  set.operations.find((operation) => operation.name === name) ??
  refuse(
    `Error: ${set.provider} has no operation "${name}".\n\n` +
      `  Find the right one with \`sovrium library search ${set.provider}\`,\n` +
      `  or read them all with \`sovrium docs library/connection-${set.provider}\`.`
  )

/** The flags that choose operations, as `library add` received them. */
export interface OperationSelection {
  readonly id: string | undefined
  readonly tag?: string | undefined
  readonly all: boolean
  readonly yes: boolean
}

/** Whether a `library add` targets operations rather than a catalogue entry. */
export const selectsOperations = (
  selection: OperationSelection,
  kinds: readonly string[]
): boolean => isOperationId(selection.id, kinds) || selection.tag !== undefined || selection.all

/** `--tag <group>`: the group's operations, or a refusal listing the groups. */
const groupOperations = (set: LibraryOperationSet, tag: string): readonly ConnectionOperation[] => {
  const names = set.groups[tag]
  if (names === undefined)
    return refuse(
      `Error: ${set.provider} has no operation group "${tag}".\n\n` +
        `  Groups: ${Object.keys(set.groups).toSorted().join(', ')}.`
    )
  return names.map((name) => operationOrRefuse(set, name))
}

/** `--all`: every operation, refused above the threshold without `--yes`. */
const allOperations = (set: LibraryOperationSet, yes: boolean): readonly ConnectionOperation[] =>
  set.operations.length > ALL_CONFIRMATION_THRESHOLD && !yes
    ? refuse(
        `Error: ${set.provider} has ${set.operations.length} operations, more than the ${ALL_CONFIRMATION_THRESHOLD} --all installs without confirmation.\n\n` +
          `  Install them all with \`sovrium library add ${set.provider} --all --yes\`,\n` +
          `  or one group with --tag <group>: ${Object.keys(set.groups).toSorted().join(', ')}.`
      )
    : set.operations

type ResolvedOperations = { readonly provider: string; readonly request: OperationsRequest }

/** `add <provider>/<operation>`: that one operation. */
const resolveOneOperation = async (
  operations: OperationsModule,
  selection: OperationSelection,
  id: string
): Promise<ResolvedOperations> => {
  if (selection.tag !== undefined || selection.all)
    return refuse(
      `Error: --tag and --all take a provider, not an operation id: \`sovrium library add ${id.split('/')[0] ?? id} --tag <group>\`.`
    )
  const parsed =
    operations.parse(id) ??
    refuse(`Error: "${id}" is not an operation id of the form <provider>/<operation>.`)
  const set = await setOrRefuse(operations, parsed.provider)
  const operation = operationOrRefuse(set, parsed.name)
  return {
    provider: set.provider,
    request: { label: id, requested: [operation], known: set.operations },
  }
}

/** `add <provider> --tag <group>` or `add <provider> --all`. */
const resolveOperationGroup = async (
  operations: OperationsModule,
  selection: OperationSelection,
  provider: string
): Promise<ResolvedOperations> => {
  if (provider === '' || provider.includes('/'))
    return refuse(
      'Error: --tag and --all take a provider, e.g. `sovrium library add lemlist --tag campaigns`.'
    )
  if (selection.tag !== undefined && selection.all)
    return refuse('Error: Choose one of --tag <group> and --all, not both.')
  const set = await setOrRefuse(operations, provider)
  const { tag } = selection
  return {
    provider: set.provider,
    request: {
      label: tag === undefined ? `${provider} --all` : `${provider} --tag ${tag}`,
      requested: tag === undefined ? allOperations(set, selection.yes) : groupOperations(set, tag),
      known: set.operations,
    },
  }
}

/**
 * The provider and operations a `library add` names — refusing, before the
 * config is looked for, anything that names no real operation.
 */
export const resolveOperationsRequest = async (
  selection: OperationSelection,
  kinds: readonly string[]
): Promise<ResolvedOperations> => {
  const operations = await loadOperationsModule()
  const id = selection.id ?? ''
  return isOperationId(id, kinds)
    ? resolveOneOperation(operations, selection, id)
    : resolveOperationGroup(operations, selection, id)
}

// =============================================================================
// show
// =============================================================================

/** One parameter as a line: where it goes, its type, whether it is required. */
const parameterLine = ([name, param]: readonly [string, OperationParam]): string => {
  const values = param.enum === undefined ? '' : ` (${param.enum.map(String).join(' | ')})`
  return `  ${name} — ${param.in}, ${param.type}${values}${param.required === true ? ', required' : ''}`
}

const renderOperation = (set: LibraryOperationSet, operation: ConnectionOperation): string => {
  const id = `${set.provider}/${operation.name}`
  const params = Object.entries(operation.params ?? {})
  const group = Object.entries(set.groups).find(([, names]) => names.includes(operation.name))?.[0]
  return [
    `# ${operation.summary ?? operation.name}`,
    '',
    `${id} — ${set.title} API operation${group === undefined ? '' : `, group ${group}`}`,
    '',
    `${operation.method} ${operation.path}`,
    '',
    ...(params.length === 0 ? ['Parameters: none'] : ['Parameters:', ...params.map(parameterLine)]),
    `Installs onto: connection/${set.provider} (library/connection/${set.provider}.yaml, under operations)`,
    `Provider documentation: ${set.docsUrl}`,
    '',
    `Install: sovrium library add ${id}`,
    `Read:    sovrium docs library/connection-${set.provider}`,
    '',
  ].join('\n')
}

/** `library show <provider>/<operation>`, as text or as the operation itself. */
export const showOperation = async (id: string, format: 'md' | 'json'): Promise<string> => {
  const operations = await loadOperationsModule()
  const parsed =
    operations.parse(id) ??
    refuse(`Error: "${id}" is not an operation id of the form <provider>/<operation>.`)
  const set = await setOrRefuse(operations, parsed.provider)
  const operation = operationOrRefuse(set, parsed.name)
  return format === 'json'
    ? `${JSON.stringify({ id, provider: set.provider, docsUrl: set.docsUrl, ...operation }, null, 2)}\n`
    : renderOperation(set, operation)
}

// =============================================================================
// search
// =============================================================================

/** One operation hit of a search. */
export interface OperationHit {
  readonly id: string
  readonly provider: string
  readonly operation: ConnectionOperation
  readonly score: number
}

/** How well one operation matches one lower-cased term. Zero means no match. */
const operationScore = (
  set: LibraryOperationSet,
  operation: ConnectionOperation,
  groups: readonly string[],
  term: string
): number =>
  [
    `${set.provider}/${operation.name}` === term || operation.name === term ? 100 : 0,
    operation.name.includes(term) ? 50 : 0,
    set.provider === term || set.title.toLowerCase() === term ? 40 : 0,
    groups.some((group) => group.includes(term)) ? 30 : 0,
    (operation.summary ?? '').toLowerCase().includes(term) ? 20 : 0,
    operation.path.toLowerCase().includes(term) ? 10 : 0,
  ].reduce((sum, score) => sum + score, 0)

/** Every operation matching EVERY term, best first, ties broken by id. */
export const rankOperations = (
  sets: readonly LibraryOperationSet[],
  terms: readonly string[]
): readonly OperationHit[] =>
  sets
    .flatMap((set) => {
      const memberships = Object.entries(set.groups).flatMap(([group, names]) =>
        names.map((name) => ({ name, group }))
      )
      const groupsOf = (name: string): readonly string[] =>
        memberships.filter((member) => member.name === name).map((member) => member.group)
      return set.operations.map((operation) => {
        const scores = terms.map((term) =>
          operationScore(set, operation, groupsOf(operation.name), term)
        )
        return {
          id: `${set.provider}/${operation.name}`,
          provider: set.provider,
          operation,
          score: scores.every((score) => score > 0) ? scores.reduce((a, b) => a + b, 0) : 0,
        }
      })
    })
    .filter((hit) => hit.score > 0)
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        left.operation.name.length - right.operation.name.length ||
        left.id.localeCompare(right.id)
    )

/**
 * The hits taken in turns, one per provider, providers in the order of their
 * best hit — so a vendor with forty matching endpoints cannot fill every slot
 * a limit leaves and hide the others.
 */
export const interleaveByProvider = (hits: readonly OperationHit[]): readonly OperationHit[] => {
  const providers = [...new Set(hits.map((hit) => hit.provider))]
  const queues = providers.map((provider) => hits.filter((hit) => hit.provider === provider))
  const rounds = Math.max(0, ...queues.map((queue) => queue.length))
  return Array.from({ length: rounds }, (_, round) => round).flatMap((round) =>
    queues.flatMap((queue) => {
      const hit = queue[round]
      return hit === undefined ? [] : [hit]
    })
  )
}

/** Operation hits grouped under a heading per provider, in order of best hit. */
export const renderOperationHits = (hits: readonly OperationHit[]): string => {
  const providers = [...new Set(hits.map((hit) => hit.provider))]
  const idWidth = Math.max(0, ...hits.map((hit) => hit.id.length))
  return providers
    .flatMap((provider) => [
      `## ${provider}`,
      '',
      ...hits
        .filter((hit) => hit.provider === provider)
        .map((hit) =>
          `${hit.id.padEnd(idWidth)}  ${hit.operation.method.padEnd(6)}  ${hit.operation.summary ?? ''}`.trimEnd()
        ),
      '',
    ])
    .join('\n')
}
