/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Retool Workflows adapter: an "Export to JSON" file as a `CanonicalFlow`.
 *
 * The file holds the graph in `blockData[]` and each block's body in
 * `templateData`, a Transit JSON string (`transit-json-service.ts`) whose
 * `plugins` map is keyed by block name. Edges are stored on the TARGET: a
 * block lists the blocks feeding it in `incomingOnSuccessEdges`, and a block
 * reached from a Branch lists `{ blockId, portId }` in `incomingPorts`.
 *
 * - **Trigger.** The start block: `webhook` becomes a webhook trigger,
 *   `schedule` (or the file's own `crontab`) a schedule, anything else manual.
 * - **Code.** A JavaScript or Python block becomes a code step keeping its
 *   code; its language is the plugin's `subtype`, never `editorMode`, which
 *   reads `sql` even for JavaScript.
 * - **Branch.** The conditions come from the block's own `options.conditions`;
 *   the JavaScript Retool generates from them (`executePathAtMostOnce`) is
 *   never read.
 * - **REST.** A request; a credential header is left out, and a URL that is a
 *   credential is moved to the environment by the mapper.
 * - **Resource queries** (SQL and the rest) are kept verbatim as TODOs: the
 *   export does not hold the resource they run against.
 * - **Loop** becomes a loop over its input; its per-item code is not read.
 * - **Response** becomes the webhook's reply. Anything else is a TODO.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { isCredentialName } from './credential-redaction-service'
import {
  retoolCondition,
  tokeniseRetoolValue,
  type RetoolScope,
} from './retool-workflow-expression-service'
import { decodeTransitJson } from './transit-json-service'
import type { CanonicalFlow, CanonicalStep } from './canonical-flow'
import type { ImportReport } from './import-report'

type Json = Readonly<Record<string, unknown>>
type Edge = CanonicalFlow['edges'][number]

/** One block of `blockData[]`, the fields the adapter reads. */
interface Block {
  readonly uuid: string
  readonly name: string
  readonly blockType: string
  readonly editorType: string
  readonly resourceName: string
  readonly options: Json
  readonly incoming: readonly string[]
  readonly ports: readonly { readonly blockId: string; readonly portId: string }[]
}

/** A block's body: the plugin `subtype` and the `template` it carries. */
interface Plugin {
  readonly subtype: string | undefined
  readonly template: Json
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const records = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const blockOf = (raw: Json): Block | undefined => {
  const uuid = text(raw['uuid'])
  const name = text(raw['pluginId'])
  if (uuid === '' || name === '' || typeof raw['blockType'] !== 'string') return undefined
  return {
    uuid,
    name,
    blockType: raw['blockType'],
    editorType: text(raw['editorType']),
    resourceName: text(raw['resourceName']),
    options: isRecord(raw['options']) ? raw['options'] : {},
    incoming: (Array.isArray(raw['incomingOnSuccessEdges'])
      ? raw['incomingOnSuccessEdges']
      : []
    ).filter((id): id is string => typeof id === 'string'),
    ports: records(raw['incomingPorts']).map((port) => ({
      blockId: text(port['blockId']),
      portId: text(port['portId']),
    })),
  }
}

/** Whether a parsed JSON document is a Retool workflow "Export to JSON" file. */
export const isRetoolWorkflowExport = (document: unknown): boolean =>
  isRecord(document) &&
  typeof document['templateData'] === 'string' &&
  Array.isArray(document['blockData']) &&
  document['blockData'].length > 0 &&
  document['blockData'].every((block) => isRecord(block) && blockOf(block) !== undefined)

/** Each block's body, by block name, read from the Transit-encoded `templateData`. */
const pluginsOf = (templateData: string): ReadonlyMap<string, Plugin> => {
  const decoded = decodeTransitJson(templateData)
  const plugins = isRecord(decoded) && isRecord(decoded['plugins']) ? decoded['plugins'] : {}
  return new Map(
    Object.entries(plugins).flatMap(([name, plugin]) =>
      isRecord(plugin)
        ? [
            [
              name,
              {
                subtype: typeof plugin['subtype'] === 'string' ? plugin['subtype'] : undefined,
                template: isRecord(plugin['template']) ? plugin['template'] : {},
              },
            ] as const,
          ]
        : []
    )
  )
}

const TRIGGER_TYPES: ReadonlySet<string> = new Set(['webhook', 'schedule'])

/** The block that starts the workflow. */
const startBlockOf = (blocks: readonly Block[]): Block | undefined =>
  blocks.find((block) => TRIGGER_TYPES.has(block.blockType)) ??
  blocks.find((block) => block.name === 'startTrigger')

/** A schedule start, or the file's own `crontab` when the start block does not carry one. */
const scheduleOf = (start: Block | undefined, document: Json): CanonicalFlow['trigger'] => {
  const options = start?.options ?? {}
  const cron = text(options['crontab']) || text(document['crontab'])
  const timezone = text(options['timezone']) || text(document['timezone'])
  return cron === ''
    ? { kind: 'unknown', sourceType: 'schedule', raw: options }
    : { kind: 'schedule', cron, ...(timezone === '' ? {} : { timezone }) }
}

const triggerOf = (start: Block | undefined, document: Json): CanonicalFlow['trigger'] => {
  if (start?.blockType === 'webhook') return { kind: 'webhook', method: 'POST' }
  return start?.blockType === 'schedule' || text(document['crontab']) !== ''
    ? scheduleOf(start, document)
    : { kind: 'manual' }
}

const LANGUAGES: Readonly<Record<string, 'javascript' | 'python'>> = {
  JavascriptQuery: 'javascript',
  PythonQuery: 'python',
}

/** A list of `{ key, value }` pairs written as JSON (Retool's headers and JSON bodies) as an object. */
const pairsOf = (value: unknown): Json | undefined => {
  const parsed = ((): unknown => {
    try {
      return typeof value === 'string' ? (JSON.parse(value) as unknown) : value
    } catch {
      // Not a JSON list of pairs: the caller keeps the value as written.
      return undefined
    }
  })()
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) return undefined
  return Object.fromEntries(
    parsed
      .filter((pair) => text(pair['key']) !== '')
      .map((pair) => [text(pair['key']), pair['value']] as const)
  )
}

const httpOf = (block: Block, template: Json, scope: RetoolScope): CanonicalStep => {
  const headers = Object.fromEntries(
    Object.entries(pairsOf(template['headers']) ?? {}).filter(([name]) => !isCredentialName(name))
  )
  const rawBody = template['body']
  const body = pairsOf(rawBody) ?? (text(rawBody) === '' ? undefined : rawBody)
  return {
    id: block.name,
    name: block.name,
    kind: 'http',
    method: text(template['type']) || 'GET',
    url: tokeniseRetoolValue(text(template['query']), scope),
    headers: tokeniseRetoolValue(headers, scope) as Json,
    ...(body === undefined ? {} : { body: tokeniseRetoolValue(body, scope) }),
  }
}

/** A label for each condition of a Branch, by its outgoing port. */
const branchLabels = (block: Block): ReadonlyMap<string, string> =>
  new Map(
    records(block.options['conditions']).map((condition, index) => {
      const type = text(condition['type'])
      const label = type === 'if' || type === 'else' ? type : `else if ${String(index)}`
      return [text(condition['outgoingPortId']), label] as const
    })
  )

const branchOf = (block: Block, scope: RetoolScope): CanonicalStep => ({
  id: block.name,
  name: block.name,
  kind: 'branch',
  branches: records(block.options['conditions']).map((condition) => {
    const label = branchLabels(block).get(text(condition['outgoingPortId'])) ?? 'if'
    return text(condition['type']) === 'else'
      ? { name: label }
      : { name: label, condition: retoolCondition(text(condition['statement']), scope) }
  }),
})

const unknownOf = (
  block: Block,
  sourceType: string,
  plugin: Plugin | undefined
): CanonicalStep => ({
  id: block.name,
  name: block.name,
  kind: 'unknown',
  sourceType,
  raw: {
    block: block.name,
    blockType: block.blockType,
    editorType: block.editorType,
    resource: block.resourceName,
    query: plugin?.template['query'],
  },
})

/** What reading one block needs. */
interface BlockRead {
  readonly block: Block
  readonly template: Json
  /** The plugin's `subtype` (`JavascriptQuery`, `RESTQuery`), else the block's `editorType`. */
  readonly kind: string
  readonly scope: RetoolScope
}

/** The readers of the block types that map, by `blockType`. */
const BLOCK_READERS: Readonly<Record<string, (read: BlockRead) => CanonicalStep | undefined>> = {
  code: ({ block, template, kind }) => ({
    id: block.name,
    name: block.name,
    kind: 'code',
    lang: LANGUAGES[kind] ?? 'other',
    source: text(template['query']),
  }),
  conditional: ({ block, scope }) => branchOf(block, scope),
  loop: ({ block, template, scope }) => ({
    id: block.name,
    name: block.name,
    kind: 'loop',
    over: tokeniseRetoolValue(text(template['query']), scope),
  }),
  webhookReturn: ({ block, scope }) => ({
    id: block.name,
    name: block.name,
    kind: 'app-action',
    app: 'webhookReturn',
    operation: 'response',
    inputs: tokeniseRetoolValue(
      { body: block.options['body'], status: block.options['status'] },
      scope
    ) as Json,
  }),
  default: ({ block, template, kind, scope }) =>
    kind === 'RESTQuery' ? httpOf(block, template, scope) : undefined,
}

/** One block as a step; a block no reader maps is kept verbatim. */
const stepOf = (block: Block, plugin: Plugin | undefined, scope: RetoolScope): CanonicalStep => {
  const kind = plugin?.subtype ?? block.editorType
  const read = { block, template: plugin?.template ?? {}, kind, scope }
  const step = BLOCK_READERS[block.blockType]?.(read)
  if (step !== undefined) return step
  const sourceType = block.blockType === 'default' ? `default:${kind}` : block.blockType
  return unknownOf(block, sourceType, plugin)
}

/** The edges into one block: its success edges, and the Branch ports it hangs from. */
const edgesInto = (
  block: Block,
  byUuid: ReadonlyMap<string, Block>,
  fromOf: (uuid: string) => string | undefined
): readonly Edge[] => {
  const success = block.incoming.flatMap((uuid) => {
    const from = fromOf(uuid)
    if (from === undefined) return []
    const done = byUuid.get(uuid)?.blockType === 'loop'
    return [done ? { from, to: block.name, branch: 'done' } : { from, to: block.name }]
  })
  const ported = block.ports.flatMap((port) => {
    const from = fromOf(port.blockId)
    const source = byUuid.get(port.blockId)
    const label = source === undefined ? undefined : branchLabels(source).get(port.portId)
    if (from === undefined) return []
    return [{ from, to: block.name, ...(label === undefined ? {} : { branch: label }) }]
  })
  return [...success, ...ported]
}

/** Every edge, from the blocks' incoming lists; one into the start block is dropped. */
const edgesOf = (blocks: readonly Block[], start: Block | undefined): readonly Edge[] => {
  const byUuid = new Map(blocks.map((block) => [block.uuid, block] as const))
  const fromOf = (uuid: string): string | undefined =>
    uuid === start?.uuid ? 'trigger' : byUuid.get(uuid)?.name
  return blocks.flatMap((block) => (block === start ? [] : edgesInto(block, byUuid, fromOf)))
}

/** A Retool workflow export read: its flow, and what its report adds. */
export interface RetoolWorkflowRead {
  readonly flow: CanonicalFlow
  readonly notes: ImportReport['unmapped']
}

/** What the report says about a resource query: its resource is not in the export. */
const resourceNote = (flowName: string, block: Block): ImportReport['unmapped'][number] => ({
  domain: 'automations',
  source: `${flowName} › ${block.name}`,
  kind: 'step',
  reason: `The block runs against the Retool resource "${block.resourceName}", which a Retool export never includes; its query is quoted in the TODO list. Connect the same data to Sovrium, then rebuild the step.`,
})

/** A Retool workflow "Export to JSON" file as a flow, or `undefined` when it is not one. */
export const adaptRetoolWorkflow = (document: unknown): RetoolWorkflowRead | undefined => {
  if (!isRetoolWorkflowExport(document) || !isRecord(document)) return undefined
  const blocks = records(document['blockData']).flatMap((raw) => {
    const block = blockOf(raw)
    return block === undefined ? [] : [block]
  })
  const plugins = pluginsOf(text(document['templateData']))
  const start = startBlockOf(blocks)
  const scope: RetoolScope = { trigger: start?.name }
  const read = blocks
    .filter((block) => block !== start)
    .map((block) => ({ block, step: stepOf(block, plugins.get(block.name), scope) }))
  const steps = read.map((one) => one.step)
  const name = text(document['name']) || 'Retool workflow'
  const resourceQueries = read
    .filter((one) => one.block.blockType === 'default' && one.step.kind === 'unknown')
    .map((one) => one.block)
  return {
    flow: {
      tool: 'retool-workflows',
      sourceId: name,
      name,
      active: document['isEnabled'] === true,
      trigger: triggerOf(start, document),
      steps,
      edges: edgesOf(blocks, start),
    },
    notes: resourceQueries.map((block) => resourceNote(name, block)),
  }
}
