/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * n8n's control-flow nodes as `CanonicalStep`s, read by node type and
 * `typeVersion` as the pinned workflow samples store them:
 *
 * - IF (v2 and later): a branch `true` (output 0) / `false` (output 1);
 * - Switch (v3 and later, rules mode): a branch per rule, named by the rule's
 *   output key, plus the fallback output; `allMatchingOutputs` runs every
 *   matching branch;
 * - Filter (v2 and later): a filter;
 * - Loop Over Items (SplitInBatches v3): a loop, output 0 `done`, output 1 the
 *   body. It iterates the items its node received, which no Sovrium reference
 *   names, so the list is an untranslatable expression and the loop a TODO;
 * - Wait, resumed after an interval or at a time: a pause.
 *
 * Any other version or mode returns `undefined`, and the adapter keeps the node
 * as an `unknown` step quoting it. A string comparison the node makes
 * case-insensitively is keyed with a `:ci` suffix, which no registry row maps:
 * Sovrium compares text as written.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { tokeniseN8nValue } from './n8n-expression-service'
import type { CanonicalCondition, CanonicalStep } from './canonical-flow'

type Json = Readonly<Record<string, unknown>>

/** An n8n node, as the adapter reads it. */
export interface N8nNode {
  readonly name: string
  readonly type: string
  readonly typeVersion: number
  readonly parameters: Json
  /** The credential the node runs with, labelled `n8n:<credentialType>:<id>`; never a secret. */
  readonly credential?: string
}

/** What tokenising a node's values needs. */
export interface N8nScope {
  readonly upstream: string | undefined
  readonly trigger: string | undefined
}

/** The operations whose text comparison honours `caseSensitive`. */
const TEXT_COMPARISONS = new Set([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'regex',
])

const operatorOf = (operator: Json, caseInsensitive: boolean): string => {
  const type = String(operator['type'] ?? 'any')
  const operation = String(operator['operation'] ?? '')
  const ci = caseInsensitive && type === 'string' && TEXT_COMPARISONS.has(operation)
  return `${type}:${operation}${ci ? ':ci' : ''}`
}

/** An n8n filter value (`{ conditions, combinator, options }`) as a condition. */
const conditionOf = (
  value: unknown,
  parameters: Json,
  scope: N8nScope
): CanonicalCondition | undefined => {
  if (!isRecord(value) || !Array.isArray(value['conditions'])) return undefined
  const options = isRecord(value['options']) ? value['options'] : {}
  const nodeOptions = isRecord(parameters['options']) ? parameters['options'] : {}
  const caseInsensitive =
    options['caseSensitive'] === false || nodeOptions['caseSensitive'] === false
  const rules = value['conditions'].flatMap((rule: unknown) => {
    if (!isRecord(rule) || !isRecord(rule['operator'])) return []
    const unary = rule['operator']['singleValue'] === true
    return [
      {
        left: tokeniseN8nValue(rule['leftValue'], scope.upstream, scope.trigger),
        operator: operatorOf(rule['operator'], caseInsensitive),
        ...(unary
          ? {}
          : { right: tokeniseN8nValue(rule['rightValue'], scope.upstream, scope.trigger) }),
      },
    ]
  })
  return { combinator: value['combinator'] === 'or' ? 'or' : 'and', rules }
}

const base = (node: N8nNode) => ({ id: node.name, name: node.name })

const ifStep = (node: N8nNode, scope: N8nScope): CanonicalStep | undefined => {
  const condition = conditionOf(node.parameters['conditions'], node.parameters, scope)
  if (node.typeVersion < 2 || condition === undefined) return undefined
  return {
    ...base(node),
    kind: 'branch',
    mode: 'first-match',
    branches: [{ name: 'true', condition }, { name: 'false' }],
  }
}

const filterStep = (node: N8nNode, scope: N8nScope): CanonicalStep | undefined => {
  const condition = conditionOf(node.parameters['conditions'], node.parameters, scope)
  if (node.typeVersion < 2 || condition === undefined) return undefined
  return { ...base(node), kind: 'filter', condition }
}

type Branch = Extract<CanonicalStep, { readonly kind: 'branch' }>['branches'][number]

/** A Switch rule's branch, named by its output key when renamed, else by its index. */
const ruleBranch = (
  rule: unknown,
  index: number,
  node: N8nNode,
  scope: N8nScope
): Branch | undefined => {
  if (!isRecord(rule)) return undefined
  const condition = conditionOf(rule['conditions'], node.parameters, scope)
  const key = rule['renameOutput'] === true ? rule['outputKey'] : undefined
  const name = typeof key === 'string' && key !== '' ? key : String(index)
  return condition === undefined ? undefined : { name, condition }
}

/**
 * The branches with the fallback output applied: an extra output becomes a
 * last branch with no condition; a fallback onto the last rule's output drops
 * that rule's condition. A fallback onto an earlier output would also catch
 * what later rules match, which a first-match path cannot say.
 */
const withFallback = (
  branches: readonly Branch[],
  fallback: unknown,
  allMatching: boolean
): readonly Branch[] | undefined => {
  if (fallback === undefined || fallback === 'none') return branches
  if (allMatching) return undefined
  if (fallback === 'extra') return [...branches, { name: 'fallback' }]
  if (fallback !== branches.length - 1) return undefined
  return branches.map((branch, index) =>
    index === branches.length - 1 ? { name: branch.name } : branch
  )
}

/** The rules of a Switch node in rules mode, or `undefined` for another version or mode. */
const switchRules = (node: N8nNode): readonly unknown[] | undefined => {
  const { rules, mode } = node.parameters
  const values = isRecord(rules) && Array.isArray(rules['values']) ? rules['values'] : undefined
  const rulesMode = mode === undefined || mode === 'rules'
  return node.typeVersion >= 3 && rulesMode ? values : undefined
}

const definedBranches = (
  branches: readonly (Branch | undefined)[]
): readonly Branch[] | undefined =>
  branches.some((branch) => branch === undefined)
    ? undefined
    : branches.flatMap((branch) => (branch === undefined ? [] : [branch]))

const switchStep = (node: N8nNode, scope: N8nScope): CanonicalStep | undefined => {
  const values = switchRules(node)
  const branches = definedBranches(
    (values ?? []).map((rule, index) => ruleBranch(rule, index, node, scope))
  )
  if (values === undefined || branches === undefined) return undefined
  const options = isRecord(node.parameters['options']) ? node.parameters['options'] : {}
  const allMatching = options['allMatchingOutputs'] === true
  const settled = withFallback(branches, options['fallbackOutput'], allMatching)
  const names = settled?.map((branch) => branch.name) ?? []
  if (settled === undefined || new Set(names).size !== names.length) return undefined
  return {
    ...base(node),
    kind: 'branch',
    mode: allMatching ? 'all-matching' : 'first-match',
    branches: settled,
  }
}

const loopStep = (node: N8nNode): CanonicalStep | undefined =>
  node.typeVersion < 3
    ? undefined
    : {
        ...base(node),
        kind: 'loop',
        over: {
          kind: 'expression',
          source: '={{ $input.all() }}',
          tokens: [{ kind: 'unsupported', source: '{{ $input.all() }}' }],
        },
      }

const ISO_UNITS: Readonly<Record<string, string>> = {
  seconds: 'PT{n}S',
  minutes: 'PT{n}M',
  hours: 'PT{n}H',
  days: 'P{n}D',
}

const waitStep = (node: N8nNode, scope: N8nScope): CanonicalStep | undefined => {
  const { resume, amount, unit, dateTime } = node.parameters
  if (resume === 'specificTime' && dateTime !== undefined) {
    return {
      ...base(node),
      kind: 'delay',
      until: tokeniseN8nValue(dateTime, scope.upstream, scope.trigger),
    }
  }
  const template = typeof unit === 'string' ? ISO_UNITS[unit] : undefined
  const whole = typeof amount === 'number' && Number.isInteger(amount) && amount > 0
  if ((resume !== undefined && resume !== 'timeInterval') || !whole || template === undefined) {
    return undefined
  }
  return { ...base(node), kind: 'delay', duration: template.replace('{n}', String(amount)) }
}

/** The control-flow step an n8n node is, or `undefined` when it is not one this reads. */
export const controlStepOf = (node: N8nNode, scope: N8nScope): CanonicalStep | undefined => {
  if (node.type === 'n8n-nodes-base.if') return ifStep(node, scope)
  if (node.type === 'n8n-nodes-base.switch') return switchStep(node, scope)
  if (node.type === 'n8n-nodes-base.filter') return filterStep(node, scope)
  if (node.type === 'n8n-nodes-base.splitInBatches') return loopStep(node)
  if (node.type === 'n8n-nodes-base.wait') return waitStep(node, scope)
  return undefined
}

/** The label of an edge leaving `step` by `output`, so the mapper knows which branch it takes. */
export const edgeLabelOf = (
  step: CanonicalStep | undefined,
  output: number
): string | undefined => {
  if (step?.kind === 'branch') return step.branches[output]?.name
  if (step?.kind === 'loop') return output === 0 ? 'done' : 'body'
  return output > 0 ? String(output) : undefined
}
