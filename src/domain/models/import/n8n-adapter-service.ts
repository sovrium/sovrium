/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The n8n adapter: the JSON `n8n export:workflow` writes — one workflow, or an
 * array of them — as `CanonicalFlow`s.
 *
 * - The trigger is the node no connection reaches whose type is in the
 *   trigger registry, or else the first node no connection reaches; its
 *   parameters are kept for the mapper.
 * - Every other node is a step, classified only as far as its SHAPE says: a
 *   code node is `code`, an HTTP Request node `http`, an IF, Switch, Filter,
 *   Loop Over Items or Wait node the control-flow step it is
 *   (`n8n-control-flow-service.ts`), an Edit Fields (Set) node naming fields
 *   or a node with an operation `app-action`,
 *   anything else `unknown` with its definition verbatim. Which Sovrium action
 *   it becomes is the mapper's.
 * - An edge leaving a branch is labelled with the branch it leaves by, and one
 *   leaving a loop with `done` or `body`.
 * - Parameter expressions are tokenised by `n8n-expression-service.ts`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { isCredentialName } from './credential-redaction-service'
import { lookupTrigger } from './flow-step-mappings'
import { standsForAppEvent } from './flow-step-targets'
import { controlStepOf, edgeLabelOf, type N8nNode } from './n8n-control-flow-service'
import { tokeniseN8nValue } from './n8n-expression-service'
import { N8N_SET_NODE, n8nSetInputs } from './n8n-set-node-service'
import type { CanonicalFlow, CanonicalStep } from './canonical-flow'

type Json = Readonly<Record<string, unknown>>

/**
 * The credential a node runs with, as `n8n:<credentialType>:<id>`: the first
 * one its `credentials` names. Only the type and the id are read, never a
 * secret (an export carries none), so two nodes sharing it share a connection.
 */
const credentialOf = (node: Json): { readonly credential?: string } => {
  const credentials = isRecord(node['credentials']) ? node['credentials'] : {}
  const [type, held] = Object.entries(credentials)[0] ?? []
  const id = isRecord(held) ? held['id'] : undefined
  return type === undefined || (typeof id !== 'string' && typeof id !== 'number')
    ? {}
    : { credential: `n8n:${type}:${String(id)}` }
}

const nodesOf = (workflow: Json): readonly N8nNode[] =>
  (Array.isArray(workflow['nodes']) ? workflow['nodes'] : []).flatMap((node: unknown) =>
    isRecord(node) && typeof node['name'] === 'string' && typeof node['type'] === 'string'
      ? [
          {
            name: node['name'],
            type: node['type'],
            typeVersion: typeof node['typeVersion'] === 'number' ? node['typeVersion'] : 1,
            parameters: isRecord(node['parameters']) ? node['parameters'] : {},
            ...credentialOf(node),
          },
        ]
      : []
  )

/** `connections`: `{ from: { main: [[{ node }], …] } }` as edges, in source order. */
const edgesOf = (
  workflow: Json
): readonly { readonly from: string; readonly to: string; readonly output: number }[] => {
  const connections = isRecord(workflow['connections']) ? workflow['connections'] : {}
  return Object.entries(connections).flatMap(([from, value]) => {
    const main = isRecord(value) && Array.isArray(value['main']) ? value['main'] : []
    return main.flatMap((outputs: unknown, output: number) =>
      (Array.isArray(outputs) ? outputs : []).flatMap((target: unknown) =>
        isRecord(target) && typeof target['node'] === 'string'
          ? [{ from, to: target['node'], output }]
          : []
      )
    )
  })
}

/** n8n's `{ parameters: [{ name, value }] }` as an object. */
const pairsOf = (value: unknown): Json => {
  const parameters =
    isRecord(value) && Array.isArray(value['parameters']) ? value['parameters'] : []
  return Object.fromEntries(
    parameters.flatMap((pair: unknown) =>
      isRecord(pair) && typeof pair['name'] === 'string' ? [[pair['name'], pair['value']]] : []
    )
  )
}

/**
 * Nodes that hand on the item they received unchanged, so `$json` after one
 * reads the item from before it. A loop is not one: after it, `$json` is the
 * current item of the loop.
 */
const PASS_THROUGH: ReadonlySet<string> = new Set([
  'n8n-nodes-base.if',
  'n8n-nodes-base.switch',
  'n8n-nodes-base.filter',
  'n8n-nodes-base.wait',
  'n8n-nodes-base.noOp',
])

const CODE_TYPES = new Set([
  'n8n-nodes-base.code',
  'n8n-nodes-base.function',
  'n8n-nodes-base.functionItem',
])

const languageOf = (parameters: Json): 'javascript' | 'python' =>
  parameters['language'] === 'python' || parameters['language'] === 'pythonNative'
    ? 'python'
    : 'javascript'

/**
 * The resource and operation n8n applies when a node leaves them at their
 * default: an export omits a parameter left at its default, so a Slack node
 * that posts a message carries neither. Only the apps the registry maps, and
 * only defaults the node's own description pins, are listed; a node absent
 * here that names no operation stays unmapped.
 */
export const N8N_DEFAULT_OPERATIONS: Readonly<
  Record<string, { readonly resource: string; readonly operation: string }>
> = {
  'n8n-nodes-base.slack': { resource: 'message', operation: 'post' },
  'n8n-nodes-base.gmail': { resource: 'message', operation: 'send' },
  'n8n-nodes-base.googleCalendar': { resource: 'event', operation: 'create' },
  'n8n-nodes-base.github': { resource: 'issue', operation: 'create' },
  'n8n-nodes-base.mailchimp': { resource: 'member', operation: 'create' },
  'n8n-nodes-base.discord': { resource: 'message', operation: 'send' },
}

/**
 * The `resource.operation` an n8n app node performs, as the registry keys it,
 * with n8n's own default filling a resource or an operation the export left
 * out. An operation is defaulted only under the resource it belongs to.
 */
export const n8nOperationOf = (node: {
  readonly type?: string
  readonly parameters: Json
}): string | undefined => {
  const { operation, resource } = node.parameters
  const defaults = node.type === undefined ? undefined : N8N_DEFAULT_OPERATIONS[node.type]
  const resourceOf = typeof resource === 'string' ? resource : defaults?.resource
  const operationOf =
    typeof operation === 'string'
      ? operation
      : resourceOf !== undefined && resourceOf === defaults?.resource
        ? defaults.operation
        : undefined
  if (operationOf === undefined) return undefined
  return resourceOf === undefined ? operationOf : `${resourceOf}.${operationOf}`
}

/** An HTTP Request node, its credential headers left out: the connection names them instead. */
const httpStep = (node: N8nNode, inputs: Json): CanonicalStep => {
  const body = pairsOf(inputs['bodyParameters'])
  return {
    id: node.name,
    name: node.name,
    kind: 'http',
    method: String(node.parameters['method'] ?? 'GET'),
    url: inputs['url'],
    headers: Object.fromEntries(
      Object.entries(pairsOf(inputs['headerParameters'])).filter(
        ([name]) => !isCredentialName(name)
      )
    ),
    ...(node.parameters['sendBody'] === true && Object.keys(body).length > 0 ? { body } : {}),
  }
}

/** An app node as an app step, on the credential it runs with. */
const appStep = (node: N8nNode, operation: string, inputs: Json): CanonicalStep => ({
  id: node.name,
  name: node.name,
  kind: 'app-action',
  app: node.type,
  operation,
  inputs,
  ...(node.credential === undefined ? {} : { credential: node.credential }),
})

const stepOf = (
  node: N8nNode,
  upstream: string | undefined,
  trigger: string | undefined
): CanonicalStep => {
  const base = { id: node.name, name: node.name }
  const control = controlStepOf(node, { upstream, trigger })
  if (control !== undefined) return control
  const inputs = tokeniseN8nValue(node.parameters, upstream, trigger) as Json
  if (CODE_TYPES.has(node.type)) {
    const source =
      node.parameters['jsCode'] ?? node.parameters['pythonCode'] ?? node.parameters['functionCode']
    return {
      ...base,
      kind: 'code',
      lang: languageOf(node.parameters),
      source: String(source ?? ''),
    }
  }
  if (node.type === 'n8n-nodes-base.httpRequest') return httpStep(node, inputs)
  const setInputs = node.type === N8N_SET_NODE ? n8nSetInputs(node) : undefined
  if (setInputs !== undefined) {
    const tokenised = tokeniseN8nValue(setInputs, upstream, trigger) as Json
    return { ...base, kind: 'app-action', app: node.type, operation: '', inputs: tokenised }
  }
  const operation = n8nOperationOf(node)
  if (operation !== undefined) return appStep(node, operation, inputs)
  return {
    ...base,
    kind: 'unknown',
    sourceType: node.type,
    raw: { type: node.type, parameters: node.parameters },
  }
}

/** A schedule trigger's cron expression: the first rule's, or the legacy node's. */
const scheduleOf = (parameters: Json): CanonicalFlow['trigger'] => {
  const { rule, cronExpression } = parameters
  const first = isRecord(rule) && Array.isArray(rule['interval']) ? rule['interval'][0] : undefined
  const cron =
    isRecord(first) && typeof first['expression'] === 'string'
      ? first['expression']
      : cronExpression
  return typeof cron === 'string'
    ? { kind: 'schedule', cron }
    : { kind: 'schedule', interval: JSON.stringify(parameters) }
}

/** The event an app trigger node watches: its `event`, else its `events` joined. */
const eventOf = (node: N8nNode): string => {
  const { event, events } = node.parameters
  if (typeof event === 'string') return event
  return Array.isArray(events) ? events.filter((one) => typeof one === 'string').join(',') : ''
}

/** An app trigger node as the app event its row registers a webhook for, or polls. */
const appEventOf = (node: N8nNode): CanonicalFlow['trigger'] => ({
  kind: 'app-event',
  app: node.type,
  event: eventOf(node),
  inputs: node.parameters,
  ...(node.credential === undefined ? {} : { credential: node.credential }),
})

/** The registry row of a trigger node, read with the event it watches. */
const triggerRowOf = (node: N8nNode) => lookupTrigger('n8n', node.type, eventOf(node))

const triggerOf = (node: N8nNode | undefined): CanonicalFlow['trigger'] => {
  if (node === undefined) return { kind: 'manual' }
  const row = triggerRowOf(node)
  if (standsForAppEvent(row)) return appEventOf(node)
  const target = row?.target
  if (target === 'cron') return scheduleOf(node.parameters)
  if (target === 'manual') return { kind: 'manual' }
  if (target === 'webhook') {
    const { httpMethod } = node.parameters
    return { kind: 'webhook', ...(typeof httpMethod === 'string' ? { method: httpMethod } : {}) }
  }
  return {
    kind: 'unknown',
    sourceType: node.type,
    raw: { type: node.type, parameters: node.parameters },
  }
}

/** One exported workflow as a flow. */
const flowOf = (workflow: Json, index: number): CanonicalFlow => {
  const nodes = nodesOf(workflow)
  const edges = edgesOf(workflow)
  const reached = new Set(edges.map((edge) => edge.to))
  const roots = nodes.filter((node) => !reached.has(node.name))
  const trigger = roots.find((node) => triggerRowOf(node) !== undefined) ?? roots[0]
  const typeOf = new Map(nodes.map((node) => [node.name, node.type] as const))
  const upstreamOf = (name: string, seen: readonly string[] = []): string | undefined => {
    const from = edges.find((edge) => edge.to === name)?.from
    const through =
      from !== undefined && !seen.includes(from) && PASS_THROUGH.has(typeOf.get(from) ?? '')
    return through ? upstreamOf(from, [...seen, from]) : from
  }
  const steps = nodes
    .filter((node) => node !== trigger)
    .map((node) => stepOf(node, upstreamOf(node.name), trigger?.name))
  const stepById = new Map(steps.map((step) => [step.id, step] as const))
  return {
    tool: 'n8n',
    sourceId: typeof workflow['id'] === 'string' ? workflow['id'] : String(index + 1),
    name:
      typeof workflow['name'] === 'string' && workflow['name'] !== ''
        ? workflow['name']
        : `Workflow ${String(index + 1)}`,
    active: workflow['active'] === true,
    trigger: triggerOf(trigger),
    steps,
    edges: edges.map((edge) => {
      const branch = edgeLabelOf(stepById.get(edge.from), edge.output)
      return {
        from: edge.from === trigger?.name ? 'trigger' : edge.from,
        to: edge.to,
        ...(branch === undefined ? {} : { branch }),
      }
    }),
  }
}

/** Whether a parsed JSON document has the shape of an n8n workflow export. */
export const isN8nExport = (document: unknown): boolean => {
  const workflows = Array.isArray(document) ? document : [document]
  return (
    workflows.length > 0 &&
    workflows.every(
      (workflow) =>
        isRecord(workflow) &&
        Array.isArray(workflow['nodes']) &&
        isRecord(workflow['connections']) &&
        workflow['nodes'].every(
          (node: unknown) =>
            isRecord(node) &&
            typeof node['type'] === 'string' &&
            String(node['type']).includes('n8n-nodes-')
        )
    )
  )
}

/** An n8n export as flows, in export order. */
export const adaptN8nExport = (document: unknown): readonly CanonicalFlow[] =>
  (Array.isArray(document) ? document : [document]).flatMap((workflow, index) =>
    isRecord(workflow) ? [flowOf(workflow, index)] : []
  )
