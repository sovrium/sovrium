/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The n8n expression tokenizer.
 *
 * A parameter string starting with `=` is an n8n expression, and each of its
 * `{{ … }}` parts is JavaScript. Only data references are read:
 *
 * - `$json.x`, `$json["first name"]`, `$json.items[0]` and
 *   `$input.item.json.x` read the item the node received, so the node
 *   upstream;
 * - `$node["N"].json.x`, `$('N').item.json.x`, `$('N').first().json.x` and
 *   `$('N').last().json.x` read node `N`.
 *
 * Anything else — a method call, an arrow function, a ternary, `$now` — is kept
 * verbatim as an `unsupported` token: JavaScript is never approximated.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import type { CanonicalExpression, CanonicalExpressionToken } from './canonical-flow'

/** `$node["N"]` or `$('N')` (with `.item`, `.first()` or `.last()`), then `.json`. */
const NODE_HEAD =
  /^\$(?:node\[\s*(['"])(.+?)\1\s*\]|\(\s*(['"])(.+?)\3\s*\)(?:\.(?:item|first\(\)|last\(\)))?)\.json/
/** `$json`, or `$input.item.json`: the item the node received. */
const ITEM_HEAD = /^\$(?:json|input\.item\.json)/

/** One accessor: `.key`, `["key"]`, `['key']` or `[0]`. */
const ACCESSOR = /^(?:\.([A-Za-z_$][\w$]*)|\[\s*(?:(['"])(.*?)\2|(\d+))\s*\])/

/** The accessor chain from `rest` as path segments, or `undefined` when something else follows. */
const accessorsOf = (rest: string): readonly string[] | undefined => {
  if (rest === '') return []
  const match = ACCESSOR.exec(rest)
  if (match === null) return undefined
  const segment = match[1] ?? match[3] ?? match[4] ?? ''
  const tail = accessorsOf(rest.slice(match[0].length))
  return tail === undefined ? undefined : [segment, ...tail]
}

interface Scope {
  /** The node a bare `$json` reads. */
  readonly upstream: string | undefined
  /** The trigger node's name: a reference to it reads the trigger's data. */
  readonly trigger: string | undefined
}

const refTo = (step: string, path: readonly string[], scope: Scope): CanonicalExpressionToken =>
  step === scope.trigger
    ? { kind: 'ref', root: 'trigger', path }
    : { kind: 'ref', root: 'step', step, path }

/** The token one `{{ … }}` part becomes. */
const tokenOf = (part: string, scope: Scope): CanonicalExpressionToken => {
  const inner = part.slice(2, -2).trim()
  const named = NODE_HEAD.exec(inner)
  if (named !== null) {
    const path = accessorsOf(inner.slice(named[0].length))
    if (path !== undefined) return refTo(named[2] ?? named[4] ?? '', path, scope)
  }
  const item = ITEM_HEAD.exec(inner)
  if (item !== null && scope.upstream !== undefined) {
    const path = accessorsOf(inner.slice(item[0].length))
    if (path !== undefined) return refTo(scope.upstream, path, scope)
  }
  return { kind: 'unsupported', source: part }
}

/**
 * One n8n parameter value: an expression tokenised, or the value unchanged.
 * Objects and arrays are walked.
 *
 * @param upstream - the node a bare `$json` reads.
 * @param trigger - the trigger node's name.
 */
export const tokeniseN8nValue = (
  value: unknown,
  upstream: string | undefined,
  trigger?: string
): unknown => {
  if (Array.isArray(value)) return value.map((item) => tokeniseN8nValue(item, upstream, trigger))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, tokeniseN8nValue(item, upstream, trigger)])
    )
  }
  if (typeof value !== 'string' || !value.startsWith('=')) return value
  const parts = value
    .slice(1)
    .split(/(\{\{[\s\S]*?\}\})/)
    .filter((part) => part !== '')
  const tokens = parts.map((part): CanonicalExpressionToken =>
    part.startsWith('{{') ? tokenOf(part, { upstream, trigger }) : { kind: 'text', value: part }
  )
  return { kind: 'expression', source: value, tokens } satisfies CanonicalExpression
}
