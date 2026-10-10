/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/**
 * The two substitutions a fetch action performs: the loaded record's values
 * into its URL and body before it is sent, and the response's values into the
 * messages it shows after.
 */

/**
 * Substitute `$record.<field>` references in a target string (any mode's `url`,
 * the `download` `filename`, a `body` string) against the injected row record,
 * through the one shared reader: its `|` fallback chain, its null-as-empty rule
 * and its escape (`\$record.x` is sent as the token itself). With no `record`
 * nothing is filled, so a backslash there stays as written.
 */
export function substituteRecord(
  template: string,
  record: Record<string, unknown> | undefined
): string {
  return record === undefined ? template : substituteRecordVars(template, record)
}

/**
 * Matches a `$response.<dot.path>` reference in a status message.
 *
 * Where `$record.` addresses ONE field name, a `$response.` path addresses a
 * position in a JSON document and so carries multiple dot-separated segments.
 * The trailing segment is deliberately NOT allowed to be empty (`\w+(?:\.\w+)*`
 * rather than `[\w.]+`), so a message ending a sentence — `Votre lien :
 * $response.token.` — keeps its full stop instead of consuming it into the path.
 */
const RESPONSE_PATH_PATTERN = /\$response\.(\w+(?:\.\w+)*)/g

/** A response value that can be written into the DOM as-is. */
function isRenderablePrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

/**
 * Walk a dot path into a parsed JSON body. Returns `undefined` as soon as a
 * segment lands on anything that cannot be indexed (a primitive, `null`, or a
 * missing key), so a path the body does not carry resolves to nothing rather
 * than throwing.
 */
function resolveResponsePath(body: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, segment) =>
        typeof current === 'object' && current !== null
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      body
    )
}

/**
 * Substitute `$response.<dot.path>` references in a status message against the
 * JSON body the action's own request returned — the one place a config can
 * render a value the SERVER produced (a token minted exactly once, the id of the
 * row just created).
 *
 * An unresolved path — absent key, non-primitive value (`null`, an object, an
 * array), or no body at all — substitutes the EMPTY STRING, never the literal
 * token: a `$response.token` left on screen reads as a value to anyone who did
 * not write the config. This mirrors the `$record.` rule next door, where an
 * absent cell substitutes empty too.
 *
 * A message carrying no reference is returned untouched, so every existing
 * `status.message` is unchanged.
 */
export function substituteResponse(template: string, body: unknown): string {
  if (!template.includes('$response.')) return template
  return template.replaceAll(RESPONSE_PATH_PATTERN, (_full, path: string) => {
    const value = resolveResponsePath(body, path)
    return isRenderablePrimitive(value) ? String(value) : ''
  })
}

/**
 * Resolve `$record.<field>` references in each STRING value of a JSON request
 * body against the injected row record — so a config mutate's body template
 * (`{ userId: '$record.id', role: '$record.role' }`) carries the clicked row's
 * identity into the payload. Non-string values pass through untouched, and the
 * whole body is returned unchanged when no `record` is supplied (the static-body
 * fetch path — GDPR erase / cancel — is unaffected).
 */
export function substituteRecordInBody(
  body: FetchAction['body'],
  record: Record<string, unknown> | undefined
): FetchAction['body'] {
  if (body === undefined || record === undefined) return body
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteBodyValue(value, record) : value,
    ])
  )
}

/** A body value that is ONE `$record.<field>` reference and nothing else. */
const WHOLE_RECORD_REFERENCE = /^\$record\.(\w+)$/

/**
 * One body value. A value that is exactly `$record.<field>` over a LIST field
 * sends the list itself — a multi-select's picked groups travel as an array,
 * not as their text joined into one string. Every other value is substituted
 * as text, as it always was.
 */
function substituteBodyValue(value: string, record: Record<string, unknown>): unknown {
  const field = WHOLE_RECORD_REFERENCE.exec(value)?.[1]
  const listed = field === undefined ? undefined : record[field]
  return Array.isArray(listed) ? listed : substituteRecord(value, record)
}
