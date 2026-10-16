/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `graph`'s node flag, applied to the bound records before they are placed.
 *
 * The projection places a node in several ways (a column band, a lane spine, a
 * station of a chain), each building its view from the record alone. Rather
 * than thread the declaration through every one of them, the records whose
 * `flag.field` is true are marked ONCE, here, with the flag's word under
 * {@link FLAG_MARK}, and the one function that turns a record into a view reads
 * it back. The field itself stays the bound graph's own word: an open string
 * the platform never interprets beyond "is it true".
 */

/** The declaration, as the projection reads it off the component. */
export interface GraphNodeFlagConfig {
  readonly field: string
  readonly label: string
}

type GraphRecord = Readonly<Record<string, unknown>>

/** A NUL-led key no endpoint's JSON means, so the mark cannot collide with a node field. */
export const FLAG_MARK = '\u0000flag'

/** A boolean as a node may carry it: `true`, or a SQLite `1`. */
const isTrue = (value: unknown): boolean => value === true || value === 1

/** Leave `flag.label` under {@link FLAG_MARK} on every record whose `flag.field` is true. */
export const markFlagged = (
  nodes: readonly GraphRecord[],
  flag: GraphNodeFlagConfig | undefined
): readonly GraphRecord[] =>
  flag === undefined
    ? nodes
    : nodes.map((node) => (isTrue(node[flag.field]) ? { ...node, [FLAG_MARK]: flag.label } : node))
