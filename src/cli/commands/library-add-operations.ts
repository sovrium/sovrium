/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library add <provider>/<operation>` — what an install does to the
 * `operations` of its connection fragment.
 *
 * ─── REWRITTEN ONLY WHILE IT IS STILL THE LIBRARY'S ────────────────────────
 *
 * A connection fragment belongs to the operator once installed, as every
 * fragment does, but appending an operation has to edit it. The two are
 * reconciled by one test: the fragment is rewritten only when its bytes are
 * EXACTLY what the library would write for the connection plus the operations
 * it declares. Any edit — a comment, a reordered key, an operation changed by
 * hand — and the file is left byte for byte as it is, the operations printed
 * for the operator to paste instead.
 *
 * The provenance line alone is exempt, so that an untouched fragment written
 * by an older binary is not mistaken for an edited one.
 *
 * Pure: the fragment bytes come in, the plan goes out; rendering is the
 * caller's `render`, so this module never needs the catalogue.
 */

import { createHash } from 'node:crypto'
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'

/** The operations an install declares on its connection, and what they came from. */
export interface OperationsRequest {
  /** What the operator asked for, as it is echoed back: `lemlist/get-campaigns`. */
  readonly label: string
  /** The operations to declare, in the order they are appended. */
  readonly requested: readonly ConnectionOperation[]
  /** The provider's whole set — how the operations already declared are recognised. */
  readonly known: readonly ConnectionOperation[]
}

/** What an install does to the `operations` of its connection fragment. */
export interface PlannedOperations {
  /** The operations appended — empty when every requested one is already declared. */
  readonly added: readonly ConnectionOperation[]
  /** Set when the fragment cannot be edited: the block to paste under `operations`. */
  readonly paste?: string
  /** Why the fragment cannot be edited, when it cannot. */
  readonly reason?: string
}

/** Everything the plan is made from. */
export interface OperationFragmentInput {
  readonly format: 'yaml' | 'json' | 'typescript'
  /** The connection's catalogue id, as its provenance line names it. */
  readonly id: string
  readonly relativePath: string
  /** The fragment as read, or `undefined` when there is none yet. */
  readonly onDisk: string | undefined
  readonly requested: readonly ConnectionOperation[]
  readonly known: readonly ConnectionOperation[]
  /** Set when the config defines a connection of that name outside the library. */
  readonly takenBy?: string
  /** The library's bytes for the connection with these operations. */
  readonly render: (operations: readonly ConnectionOperation[]) => string
}

/** The fragment the install writes, and what it does to its operations. */
export interface OperationFragmentPlan {
  readonly content: string
  /** Nothing is written for this fragment. */
  readonly present: boolean
  readonly operations: PlannedOperations
  /** The SHA-256 of the fragment as read, when it is rewritten. */
  readonly expectedDigest?: string
}

const sha256 = (content: string): string =>
  createHash('sha256').update(content, 'utf-8').digest('hex')

/** The block an operator pastes under `operations`, in the fragment's own format. */
const pasteBlock = (
  format: OperationFragmentInput['format'],
  operations: readonly ConnectionOperation[]
): string =>
  format === 'typescript'
    ? JSON.stringify({ operations }, null, 2)
    : Bun.YAML.stringify({ operations }, null, 2)
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trimEnd()

/** The items under a fragment's `operations`, or `undefined` when it does not parse as a list. */
const declaredOperations = (text: string): readonly unknown[] | undefined => {
  const parsed = ((): unknown => {
    try {
      return Bun.YAML.parse(text)
    } catch {
      return undefined
    }
  })()
  if (parsed === undefined) return undefined
  const declared = (parsed as { readonly operations?: unknown }).operations
  if (declared === undefined) return []
  return Array.isArray(declared) ? declared : undefined
}

/** The name of a parsed `operations` item, if it has one. */
const nameOf = (item: unknown): string | undefined => {
  const name = (item as { readonly name?: unknown } | null)?.name
  return typeof name === 'string' ? name : undefined
}

/** A fragment's text below its provenance line, when that line names `id`. */
const bodyBelowHeader = (text: string, id: string): string | undefined => {
  const cut = text.indexOf('\n')
  const header = cut === -1 ? text : text.slice(0, cut)
  return header.startsWith(`# sovrium-library: ${id}@`) ? text.slice(cut + 1) : undefined
}

/**
 * The operations a fragment declares, when the fragment is EXACTLY what the
 * library would write for them — the one case in which it may be rewritten.
 */
const pristineOperations = (
  input: OperationFragmentInput,
  onDisk: string
): readonly ConnectionOperation[] | undefined => {
  if (input.format === 'typescript') return undefined
  const declared = declaredOperations(onDisk)
  if (declared === undefined) return undefined
  const listed = declared.map((item) =>
    input.known.find((operation) => operation.name === nameOf(item))
  )
  if (listed.some((operation) => operation === undefined)) return undefined
  const operations = listed.filter((operation) => operation !== undefined)
  const actual = bodyBelowHeader(onDisk, input.id)
  return actual !== undefined && actual === bodyBelowHeader(input.render(operations), input.id)
    ? operations
    : undefined
}

/** The fragment left alone, the operations not yet declared printed to paste. */
const leaveAlone = (
  input: OperationFragmentInput,
  content: string,
  reason: string
): OperationFragmentPlan => {
  const already = new Set(
    input.format === 'yaml' && content !== ''
      ? (declaredOperations(content) ?? []).map(nameOf).filter((name) => name !== undefined)
      : []
  )
  const missing = input.requested.filter((operation) => !already.has(operation.name))
  return {
    content,
    present: true,
    operations:
      missing.length === 0
        ? { added: [] }
        : { added: missing, paste: pasteBlock(input.format, missing), reason },
  }
}

/**
 * The connection fragment with the requested operations appended — new, the
 * existing one rewritten, left as it is, or left alone with a block to paste.
 */
export const planOperationFragment = (input: OperationFragmentInput): OperationFragmentPlan => {
  const { onDisk, requested } = input
  if (input.takenBy !== undefined) return leaveAlone(input, '', input.takenBy)
  if (onDisk === undefined)
    return { content: input.render(requested), present: false, operations: { added: requested } }
  const listed = pristineOperations(input, onDisk)
  if (listed === undefined)
    return leaveAlone(
      input,
      onDisk,
      `${input.relativePath} was edited after it was installed, and library add never rewrites an edit`
    )
  const declared = new Set(listed.map((operation) => operation.name))
  const added = requested.filter((operation) => !declared.has(operation.name))
  return added.length === 0
    ? { content: onDisk, present: true, operations: { added } }
    : {
        content: input.render([...listed, ...added]),
        present: false,
        operations: { added },
        expectedDigest: sha256(onDisk),
      }
}
