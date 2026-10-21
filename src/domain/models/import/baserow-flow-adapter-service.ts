/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The adapter of the automations in a Baserow workspace export ZIP: each
 * workflow of an `automation` member as one `CanonicalFlow`.
 *
 * A workflow is a list of nodes `{ id, type, label, service }` and a `graph`
 * keyed by node id: `"0"` names the first node (the trigger), each entry's
 * `next` maps an edge to the nodes it leads to — `""` for the plain edge (a
 * router's default), a router edge's `uid` for its condition — and an
 * iterator's `children` are its body.
 *
 * - The trigger is read through the Baserow trigger registry; a row event
 *   watches the table it names, by that table's name in the same export.
 * - A row action (`local_baserow_create_row` …) is an app step named by its
 *   node type, its inputs the table and the field mappings by NAME, each value
 *   a tokenised Baserow formula. A formula that is a quoted constant is text;
 *   any other formula is kept verbatim, untranslated.
 * - A router is a branch whose conditions are Baserow formulas, kept
 *   verbatim, so a router always lands as a TODO; its default edge is the
 *   fallback branch.
 * - A node of any other type is an `unknown` step quoting its definition.
 *
 * Integrations' credentials are never read, and the service ids, sample data
 * and retry settings are dropped from what is quoted.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { idOf, type Json } from './baserow-field-service'
import { lookupTrigger } from './flow-step-mappings'
import type { CanonicalCondition, CanonicalExpression, CanonicalFlow } from './canonical-flow'

/** How the flows name what the export's databases hold. */
export interface BaserowNames {
  /** A table's name, by its Baserow id. */
  readonly table: (tableId: string) => string | undefined
  /** A field's name, by its table's and its own Baserow id. */
  readonly field: (tableId: string, fieldId: string) => string | undefined
}

type Step = CanonicalFlow['steps'][number]
type Edge = CanonicalFlow['edges'][number]

/** The service keys never carried over: ids, captured sample data, the integration. */
const DROPPED_SERVICE_KEYS = new Set(['id', 'integration_id', 'sample_data', 'type'])

/** A quoted Baserow string constant, `'VIP company'`, with `\'` escapes. */
const QUOTED = /^'((?:[^'\\]|\\.)*)'$/

/** A Baserow formula value `{ formula, mode, version }` as a tokenised expression. */
export const baserowExpression = (value: unknown): CanonicalExpression | undefined => {
  const formula = isRecord(value) ? value['formula'] : value
  if (typeof formula !== 'string' || formula.trim() === '') return undefined
  const quoted = QUOTED.exec(formula.trim())
  return {
    kind: 'expression',
    source: formula,
    tokens:
      quoted === null
        ? [{ kind: 'unsupported', source: formula }]
        : [{ kind: 'text', value: (quoted[1] ?? '').replaceAll(/\\(.)/g, '$1') }],
  }
}

/** A node's service, minus what is never carried over. */
const serviceInputs = (service: Json): Json =>
  Object.fromEntries(Object.entries(service).filter(([key]) => !DROPPED_SERVICE_KEYS.has(key)))

/** A node's label, or its type in words. */
const labelOf = (node: Json): string => {
  const { label } = node
  if (typeof label === 'string' && label.trim() !== '') return label
  const words = String(node['type'] ?? 'step')
    .replace(/^local_baserow_/, '')
    .replaceAll('_', ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

/** A row action's inputs: the table and the mapped fields by name, values tokenised. */
const rowInputs = (service: Json, names: BaserowNames): Json => {
  const tableId = idOf(service['table_id'])
  const table = tableId === undefined ? undefined : (names.table(tableId) ?? tableId)
  const data = Object.fromEntries(
    arrayOf(service['field_mappings'])
      .filter(isRecord)
      .filter((mapping) => mapping['enabled'] !== false)
      .flatMap((mapping) => {
        const fieldId = idOf(mapping['field_id'])
        const value = baserowExpression(mapping['value'])
        if (fieldId === undefined || value === undefined) return []
        const name = tableId === undefined ? undefined : names.field(tableId, fieldId)
        return [[name ?? `field_${fieldId}`, value] as const]
      })
  )
  const row = baserowExpression(service['row_id'])
  return {
    ...(table === undefined ? {} : { table }),
    ...(row === undefined ? {} : { row }),
    ...(Object.keys(data).length === 0 ? {} : { data }),
  }
}

const routerOf = (node: Json, service: Json): Step => {
  const edges = arrayOf(service['edges']).filter(isRecord)
  const fallback = String(service['default_edge_label'] ?? '') || 'Default'
  const branches = edges.map((edge, index) => {
    const left = baserowExpression(edge['condition'])
    const condition: CanonicalCondition = {
      combinator: 'and',
      rules: left === undefined ? [] : [{ left, operator: 'formula' }],
    }
    return { name: String(edge['label'] ?? '') || `Branch ${String(index + 1)}`, condition }
  })
  return {
    id: String(node['id']),
    name: labelOf(node),
    kind: 'branch',
    branches: [...branches, { name: fallback }],
  }
}

const ROW_ACTION = /^local_baserow_(?:create|update|delete|upsert)_rows?$/

/** One non-trigger node as a step. */
const stepOf = (node: Json, names: BaserowNames): Step => {
  const service = isRecord(node['service']) ? node['service'] : {}
  const type = String(node['type'] ?? '')
  const id = String(node['id'])
  if (type === 'router') return routerOf(node, service)
  if (type === 'iterator') {
    return { id, name: labelOf(node), kind: 'loop', over: baserowExpression(service['source']) }
  }
  if (ROW_ACTION.test(type)) {
    return {
      id,
      name: labelOf(node),
      kind: 'app-action',
      app: type,
      operation: String(service['type'] ?? type),
      inputs: rowInputs(service, names),
    }
  }
  return {
    id,
    name: labelOf(node),
    kind: 'unknown',
    sourceType: type,
    raw: { type, label: node['label'] ?? '', service: serviceInputs(service) },
  }
}

/** The event a row trigger watches, by its node type. */
const ROW_EVENTS: Readonly<Record<string, 'create' | 'update' | 'delete'>> = {
  local_baserow_rows_created: 'create',
  local_baserow_rows_updated: 'update',
  local_baserow_rows_deleted: 'delete',
}

const triggerOf = (node: Json | undefined, names: BaserowNames): CanonicalFlow['trigger'] => {
  if (node === undefined) return { kind: 'manual' }
  const type = String(node['type'] ?? '')
  const service = isRecord(node['service']) ? node['service'] : {}
  const target = lookupTrigger('baserow', type)?.target
  const event = ROW_EVENTS[type]
  const tableId = idOf(service['table_id'])
  if (target === 'record' && event !== undefined && tableId !== undefined) {
    return { kind: 'record', table: names.table(tableId) ?? tableId, events: [event] }
  }
  if (target === 'manual') return { kind: 'manual' }
  return { kind: 'unknown', sourceType: type, raw: { type, service: serviceInputs(service) } }
}

/** Each router's edge keys (`""` for its default) to the branch they leave by. */
const routerLabels = (steps: readonly Step[], nodes: readonly Json[]) =>
  new Map(
    steps.flatMap((step) => {
      if (step.kind !== 'branch') return []
      const node = nodes.find((candidate) => String(candidate['id']) === step.id)
      const service = isRecord(node?.['service']) ? node['service'] : {}
      const uids = arrayOf(service['edges'])
        .filter(isRecord)
        .map((edge) => String(edge['uid'] ?? ''))
      const labels = new Map([
        ...uids.map((uid, index) => [uid, step.branches[index]?.name ?? uid] as const),
        ['', step.branches.at(-1)?.name ?? 'Default'] as const,
      ])
      return [[step.id, labels] as const]
    })
  )

/** The graph's edges: the trigger's as `trigger`, a router's labelled, a loop's body and done. */
const edgesOf = (
  graph: Json,
  triggerId: string | undefined,
  labels: ReadonlyMap<string, ReadonlyMap<string, string>>,
  loops: ReadonlySet<string>
): readonly Edge[] =>
  Object.entries(graph)
    .filter(([key]) => key !== '0')
    .flatMap(([from, entry]) => {
      if (!isRecord(entry)) return []
      const source = from === triggerId ? 'trigger' : from
      const body = arrayOf(entry['children']).flatMap((to) => {
        const id = idOf(to)
        return id === undefined ? [] : [{ from: source, to: id, branch: 'body' }]
      })
      const next = Object.entries(isRecord(entry['next']) ? entry['next'] : {}).flatMap(
        ([key, targets]) => {
          const label = loops.has(from) ? 'done' : labels.get(from)?.get(key)
          return arrayOf(targets).flatMap((to) => {
            const id = idOf(to)
            return id === undefined
              ? []
              : [{ from: source, to: id, ...(label === undefined ? {} : { branch: label }) }]
          })
        }
      )
      return [...body, ...next]
    })

const flowOf = (workflow: Json, names: BaserowNames): CanonicalFlow => {
  const nodes = arrayOf(workflow['nodes']).filter(isRecord)
  const graph = isRecord(workflow['graph']) ? workflow['graph'] : {}
  const triggerId = idOf(graph['0'])
  const trigger = nodes.find((node) => idOf(node['id']) === triggerId)
  const steps = nodes.filter((node) => node !== trigger).map((node) => stepOf(node, names))
  const name = typeof workflow['name'] === 'string' ? workflow['name'].trim() : ''
  return {
    tool: 'baserow',
    sourceId: idOf(workflow['id']) ?? name,
    name: name === '' ? `Workflow ${String(workflow['id'] ?? '')}`.trim() : name,
    active: workflow['state'] === 'live',
    trigger: triggerOf(trigger, names),
    steps,
    edges: edgesOf(
      graph,
      triggerId,
      routerLabels(steps, nodes),
      new Set(steps.flatMap((step) => (step.kind === 'loop' ? [step.id] : [])))
    ),
  }
}

/** Whether a member is a Baserow `automation` application. */
export const isBaserowAutomation = (document: unknown): document is Json =>
  isRecord(document) && document['type'] === 'automation' && Array.isArray(document['workflows'])

/** The workflows of the automation members as flows, in export order. */
export const adaptBaserowAutomations = (
  automations: readonly Json[],
  names: BaserowNames
): readonly CanonicalFlow[] =>
  automations.flatMap((automation) =>
    arrayOf(automation['workflows'])
      .filter(isRecord)
      .toSorted((a, b) => Number(a['order'] ?? 0) - Number(b['order'] ?? 0))
      .map((workflow) => flowOf(workflow, names))
  )
