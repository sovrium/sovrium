/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The part of the read gate on a retrieved RAG chunk that depends on nothing
 * but the chunk itself: which row it was cut from, and whether the fields it
 * records are all readable.
 *
 * A table chunk is written as `table:<name>:<recordId>:<chunkIndex>` and
 * records the names of the fields whose values its text holds. Its text is
 * fixed at ingest and cannot be masked afterwards, so the chunk is served
 * whole or not at all: only when it names at least one field and EVERY field
 * it names is readable. A chunk naming no field — every chunk written before
 * chunks recorded them — cannot be judged, and is dropped.
 *
 * What "readable" means is the caller's: the fields the running config
 * declares (no caller judged), a reader's field grants (a RAG search), or a
 * run starter's column scope (an agent step started by hand). This module
 * holds the parser and the rule; each caller supplies the predicate.
 */

/** The table and row a chunk was cut from. */
export interface ChunkSourceRow {
  readonly table: string
  readonly recordId: string
}

/** The table and row a chunk was cut from, or `undefined` for a non-table chunk. */
export const rowOfSourceRef = (sourceRef: string | null): ChunkSourceRow | undefined => {
  if (sourceRef === null) return undefined
  const [kind, table, recordId] = sourceRef.split(':')
  return kind === 'table' && table && recordId !== undefined ? { table, recordId } : undefined
}

/** True when a table chunk records at least one field name it can be judged by. */
export const chunkNamesFields = (chunkFields: ReadonlyArray<string> | undefined): boolean =>
  chunkFields !== undefined && chunkFields.length > 0

/**
 * True when a table chunk names the fields it holds and every one of them is
 * readable. A chunk that names none is unreadable to everyone.
 */
export const chunkHoldsOnlyReadable = (
  chunkFields: ReadonlyArray<string> | undefined,
  isReadable: (field: string) => boolean
): boolean =>
  chunkFields !== undefined && chunkNamesFields(chunkFields) && chunkFields.every(isReadable)
