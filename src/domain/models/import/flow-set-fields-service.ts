/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A step that sets NAMED values — an n8n Edit Fields (Set) node, a Make Set
 * variable(s) module — as a `data/set` step with `fields`.
 *
 * - A field keeps its source name when a template can read it back; any other
 *   name is written in snake case (`first name` → `first_name`, `2fa` →
 *   `field_2fa`, the reserved `result` → `result_field`).
 * - Where the source reads a dotted name as a path (n8n's default dot
 *   notation), `address.city` nests under `address`.
 * - Every reference to a renamed field follows it: {@link fieldPathsByStep}
 *   is read by the expression renderer, so `$json["first name"]` becomes
 *   `{{<step>.result.first_name}}`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { type FieldsSource } from './flow-set-fields-mappings'
import { lookupStep, type AutomationSourceTool } from './flow-step-mappings'
import { toSnakeName } from './import-names-service'
import type { CanonicalStep } from './canonical-flow'

/** What `data/set` accepts as a field name, mirroring its schema. */
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

/** `result` is the alias every step output is also read under, so no field may take it. */
const RESERVED_FIELD_NAMES: ReadonlySet<string> = new Set(['result'])

/** A source name, and the value the step gives it (expressions still tokenised). */
export interface SourceField {
  readonly name: string
  readonly value: unknown
}

/** The named values a step sets, as its source states them. */
export interface SourceFields {
  readonly pairs: readonly SourceField[]
  /** Whether a dotted name is a path, nesting under its first segment. */
  readonly dotted: boolean
  /** Whether the step also handed on the rest of its input, which `data/set` cannot. */
  readonly keepsInput: boolean
}

/** Where each source name lands in the `fields` map: one segment, or a nested path. */
export type FieldPaths = ReadonlyMap<string, readonly string[]>

const pairOf = (item: unknown, spec: FieldsSource): readonly SourceField[] => {
  if (!isRecord(item)) return []
  const name = item[spec.name]
  return typeof name === 'string' && name !== '' ? [{ name, value: item[spec.value] }] : []
}

/**
 * The named values a step's inputs hold, read the way its registry row says,
 * or `undefined` when they hold none.
 */
export const sourceFieldsOf = (
  spec: FieldsSource,
  inputs: Readonly<Record<string, unknown>>
): SourceFields | undefined => {
  const list = spec.list === undefined ? [inputs] : inputs[spec.list]
  const pairs = Array.isArray(list) ? list.flatMap((item: unknown) => pairOf(item, spec)) : []
  if (pairs.length === 0) return undefined
  return {
    pairs,
    dotted: spec.dotted !== undefined && inputs[spec.dotted] !== false,
    keepsInput: spec.keepsInput !== undefined && inputs[spec.keepsInput] === true,
  }
}

/** A name a template can read back after `.result.`: kept when it already is one. */
export const safeFieldName = (name: string): string => {
  if (FIELD_NAME.test(name) && !RESERVED_FIELD_NAMES.has(name)) return name
  const snake = toSnakeName(name, 'field').slice(0, 64)
  return RESERVED_FIELD_NAMES.has(snake) ? `${snake}_field` : snake
}

/** Where each source name lands: a dotted name, when the source reads it as a path, nests. */
export const fieldPathsOf = (fields: SourceFields): FieldPaths =>
  new Map(
    fields.pairs.map(({ name }) => {
      const segments = fields.dotted && name.includes('.') ? name.split('.') : [name]
      return [name, segments.map(safeFieldName)] as const
    })
  )

/** `target` with `value` written at `path`, a non-object on the way replaced by an object. */
const setIn = (
  target: Readonly<Record<string, unknown>>,
  path: readonly string[],
  value: unknown
): Readonly<Record<string, unknown>> => {
  const [head, ...rest] = path
  if (head === undefined) return target
  if (rest.length === 0) return { ...target, [head]: value }
  const inner = target[head]
  return { ...target, [head]: setIn(isRecord(inner) ? inner : {}, rest, value) }
}

/** The `fields` map: every value, rendered, at the path its name lands on. */
export const fieldsMapOf = (
  fields: SourceFields,
  render: (value: unknown) => unknown
): Readonly<Record<string, unknown>> => {
  const paths = fieldPathsOf(fields)
  return fields.pairs.reduce<Readonly<Record<string, unknown>>>(
    (map, { name, value }) => setIn(map, paths.get(name) ?? [name], render(value)),
    {}
  )
}

/** The named values a step sets, when its registry row reads it as a `data/set` with fields. */
export const setStepFieldsOf = (
  step: CanonicalStep,
  tool: AutomationSourceTool
): SourceFields | undefined => {
  if (step.kind !== 'app-action') return undefined
  const spec = lookupStep(tool, step.app, step.operation)?.fields
  return spec === undefined ? undefined : sourceFieldsOf(spec, step.inputs)
}

/**
 * For every step that becomes a `data/set` with fields, where each of its
 * source names lands — so a reference to `first name` reads `first_name`.
 */
export const fieldPathsByStep = (
  steps: readonly CanonicalStep[],
  tool: AutomationSourceTool
): ReadonlyMap<string, FieldPaths> =>
  new Map(
    steps.flatMap((step) => {
      const fields = setStepFieldsOf(step, tool)
      return fields === undefined ? [] : [[step.id, fieldPathsOf(fields)] as const]
    })
  )

/**
 * A reference's path into a set step's output, its leading source name
 * replaced by where that name landed. The longest dotted prefix that is a
 * source name wins, so `["address.city"]` and `["address", "city"]` both read
 * the nested field.
 */
export const fieldReferencePath = (
  path: readonly string[],
  paths: FieldPaths | undefined
): readonly string[] => {
  if (paths === undefined) return path
  const length = Array.from({ length: path.length }, (_unused, index) => path.length - index).find(
    (size) => paths.has(path.slice(0, size).join('.'))
  )
  if (length === undefined) return path
  return [...(paths.get(path.slice(0, length).join('.')) ?? []), ...path.slice(length)]
}
