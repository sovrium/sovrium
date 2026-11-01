/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * Narrowing a JSON Schema document to the node a dotted CONFIG path names.
 *
 * The dotted form (`tables.fields`) is the vocabulary a config author already
 * writes and the one a decode finding's `path` speaks, rather than the JSON
 * pointer the document itself would want (`/properties/tables/items/...`). The
 * walk therefore has to see through the three things a rendered schema puts
 * between one key and the next: a `$ref` into `$defs`, a nullable union, and an
 * array standing for its element.
 *
 * Pure: the document is passed in, so a caller that renders it once can narrow
 * it any number of times.
 */

/** One node of a JSON Schema document. */
export type JsonSchemaNode = Readonly<Record<string, unknown>>

/** What a dotted path resolved to, or the segment that did not resolve. */
export type JsonSchemaPathResult =
  | { readonly found: true; readonly schema: JsonSchemaNode }
  | {
      readonly found: false
      /** The segment that named nothing. */
      readonly segment: string
      /** The dotted path that DID resolve before it; `''` is the root. */
      readonly resolved: string
      /** The keys that resolve where the walk stopped, for the refusal. */
      readonly availableKeys: ReadonlyArray<string>
    }

/** How far a `$ref` chain or a union nest is followed before the walk stops. */
const MAX_DEPTH = 16

/** Follow `$ref: '#/$defs/X'` to the definition it names. Cycle-safe by depth. */
const deref = (node: JsonSchemaNode, root: JsonSchemaNode, depth = 0): JsonSchemaNode => {
  const ref = node['$ref']
  if (typeof ref !== 'string' || !ref.startsWith('#/$defs/') || depth > MAX_DEPTH) return node
  const defs = root['$defs']
  if (!isRecord(defs)) return node
  const target = defs[ref.slice('#/$defs/'.length)]
  return isRecord(target) ? deref(target, root, depth + 1) : node
}

/**
 * Drop the `null` arm of a nullable union and follow into the real branch.
 *
 * Every optional root key renders as `anyOf: [{ $ref }, { type: 'null' }]`, so
 * a walk that did not unwrap would stop at the union and report that `tables`
 * declares nothing.
 */
const unwrapUnion = (node: JsonSchemaNode, root: JsonSchemaNode, depth = 0): JsonSchemaNode => {
  const branches = node['anyOf'] ?? node['oneOf']
  if (!Array.isArray(branches) || depth > MAX_DEPTH) return node
  const real = branches
    .filter((branch): branch is JsonSchemaNode => isRecord(branch))
    .map((branch) => deref(branch, root))
    .find((branch) => branch['type'] !== 'null')
  return real === undefined ? node : unwrapUnion(real, root, depth + 1)
}

/** An array node stands for its element: `tables.fields` means a TABLE's fields. */
const throughArray = (node: JsonSchemaNode, root: JsonSchemaNode): JsonSchemaNode => {
  const { items } = node
  return isRecord(items) ? unwrapUnion(deref(items, root), root) : node
}

/** The node a dotted path names, normalised so the caller gets a usable schema. */
const normalise = (node: JsonSchemaNode, root: JsonSchemaNode): JsonSchemaNode =>
  unwrapUnion(deref(node, root), root)

const keysAt = (node: JsonSchemaNode): ReadonlyArray<string> => {
  const { properties } = node
  return isRecord(properties) ? Object.keys(properties) : []
}

interface WalkState {
  readonly node: JsonSchemaNode
  readonly resolved: string
  readonly miss?: Extract<JsonSchemaPathResult, { readonly found: false }>
}

const walkSegment = (state: WalkState, segment: string, root: JsonSchemaNode): WalkState => {
  if (state.miss !== undefined) return state
  const here = throughArray(normalise(state.node, root), root)
  const { properties } = here
  const next = isRecord(properties) ? properties[segment] : undefined
  if (!isRecord(next))
    return {
      ...state,
      miss: { found: false, segment, resolved: state.resolved, availableKeys: keysAt(here) },
    }
  return {
    node: next,
    resolved: state.resolved === '' ? segment : `${state.resolved}.${segment}`,
  }
}

/**
 * The whole document, or the sub-schema at a dotted config path.
 *
 * The returned sub-schema is DEREFERENCED at its root but keeps any nested
 * `#/$defs/...` pointers, so it stays a fraction of the whole document while
 * remaining resolvable against it. A blank path, or one made only of dots,
 * names the root.
 */
export const resolveJsonSchemaPath = (
  root: JsonSchemaNode,
  path: string | undefined
): JsonSchemaPathResult => {
  const segments = (path ?? '')
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
  if (segments.length === 0) return { found: true, schema: root }
  const walked = segments.reduce<WalkState>((state, segment) => walkSegment(state, segment, root), {
    node: root,
    resolved: '',
  })
  return walked.miss ?? { found: true, schema: normalise(walked.node, root) }
}
