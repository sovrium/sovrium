/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How much of a trigger's body a run's history keeps.
 *
 * A run executes with the whole body it was started with. What its history
 * row keeps is bounded: a body whose JSON is larger than
 * {@link MAX_STORED_TRIGGER_BODY_BYTES} is stored as a marker naming its size
 * instead, so a caller posting large bodies to a public webhook cannot grow
 * the database by a megabyte per call.
 */

/** The largest body, in bytes of its JSON, a run's history keeps as it was. */
export const MAX_STORED_TRIGGER_BODY_BYTES = 64 * 1024

/** What a run's history keeps in place of a body past the bound. */
export interface TruncatedTriggerBody {
  readonly truncated: true
  /** The size of the body's JSON, in bytes. */
  readonly bytes: number
}

const jsonBytes = (value: unknown): number => {
  const json = JSON.stringify(value) as string | undefined
  return json === undefined ? 0 : new TextEncoder().encode(json).byteLength
}

/**
 * `data` as a run's history keeps it: unchanged when it carries no body or a
 * body within the bound, otherwise with the body replaced by its
 * {@link TruncatedTriggerBody} marker.
 */
export const boundStoredTriggerBody = <T>(data: T): T => {
  if (typeof data !== 'object' || data === null || !('body' in data)) return data
  const bytes = jsonBytes(data.body)
  if (bytes <= MAX_STORED_TRIGGER_BODY_BYTES) return data
  const marker: TruncatedTriggerBody = { truncated: true, bytes }
  return { ...data, body: marker }
}
