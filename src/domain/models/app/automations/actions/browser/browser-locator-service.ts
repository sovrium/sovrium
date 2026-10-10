/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { LOCATOR_KINDS } from './step-locator'

/**
 * Reading a locator a MODEL wrote: a self-healing
 * suggestion, or the element a browser agent's action names.
 *
 * The model answers with the `browser/run` locator grammar — exactly one of
 * `role` (with an optional `name`), `label`, `text`, `placeholder`, `testId`
 * and `selector`, refined by `exact` and `nth` — so a suggestion is the line a
 * developer would paste into the config. Anything else is refused here, before
 * the driver sees it:
 *
 * - an unknown key, or a value of the wrong type;
 * - none, or several, of the ways of finding an element;
 * - a template (`{{…}}`) or a `$env` reference in any text: a model's answer is
 *   matched against the page as written, never filled in from the run, so it
 *   cannot pull a secret into a locator and from there into an error message.
 *
 * Pure.
 */

/** A locator as a model wrote it, checked. */
export interface ModelLocator {
  readonly role?: string
  readonly name?: string
  readonly label?: string
  readonly text?: string
  readonly placeholder?: string
  readonly testId?: string
  readonly selector?: string
  readonly exact?: boolean
  readonly nth?: number
}

/** The checked locator, or why it was refused. */
export type ModelLocatorResult =
  | { readonly ok: true; readonly locator: ModelLocator }
  | { readonly ok: false; readonly reason: string }

const TEXT_KEYS = ['role', 'name', 'label', 'text', 'placeholder', 'testId', 'selector'] as const
const KNOWN_KEYS: ReadonlySet<string> = new Set([...TEXT_KEYS, 'exact', 'nth'])

/** Text a model may not put in a locator: a template, or an environment reference. */
const FILLED_IN = /\{\{|\$env\./

const refuse = (reason: string): ModelLocatorResult => ({ ok: false, reason })

/** Why the text fields are refused, or `undefined`. */
const textRefusal = (record: Readonly<Record<string, unknown>>): string | undefined => {
  const bad = TEXT_KEYS.find(
    (key) =>
      record[key] !== undefined &&
      (typeof record[key] !== 'string' || record[key] === '' || FILLED_IN.test(record[key]))
  )
  return bad === undefined
    ? undefined
    : `\`${bad}\` must be plain, non-empty text (no template, no $env)`
}

type LocatorRecord = Readonly<Record<string, unknown>>

/** Why the shape (one way of finding, `name` with `role`) is refused, or `undefined`. */
const shapeRefusal = (record: LocatorRecord): string | undefined => {
  const kinds = LOCATOR_KINDS.filter((kind) => record[kind] !== undefined)
  if (kinds.length !== 1) {
    return 'a locator takes exactly one of `role`, `label`, `text`, `placeholder`, `testId` and `selector`'
  }
  return record['name'] !== undefined && record['role'] === undefined
    ? '`name` requires `role`'
    : undefined
}

/** Why the refinements (`exact`, `nth`) are refused, or `undefined`. */
const refinementRefusal = (record: LocatorRecord): string | undefined => {
  if (record['exact'] !== undefined && typeof record['exact'] !== 'boolean') {
    return '`exact` is true or false'
  }
  const { nth } = record
  return nth !== undefined && (typeof nth !== 'number' || !Number.isInteger(nth) || nth < 0)
    ? '`nth` is a whole number from 0'
    : undefined
}

/** Check a value a model gave as a locator. */
export const checkModelLocator = (value: unknown): ModelLocatorResult => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return refuse('a locator is an object such as { "label": "Email" }')
  }
  const record = value as LocatorRecord
  const unknown = Object.keys(record).find((key) => !KNOWN_KEYS.has(key))
  const reason =
    (unknown === undefined ? undefined : `\`${unknown}\` is not a locator key`) ??
    textRefusal(record) ??
    shapeRefusal(record) ??
    refinementRefusal(record)
  return reason === undefined ? { ok: true, locator: record as ModelLocator } : refuse(reason)
}

/**
 * The JSON object a model answered with, read from its text: the whole reply,
 * or the first `{…}` in it (models wrap JSON in prose or a code fence).
 */
export const jsonObjectIn = (reply: string): unknown => {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end < start) return undefined
  try {
    return JSON.parse(reply.slice(start, end + 1)) as unknown
  } catch {
    return undefined
  }
}
