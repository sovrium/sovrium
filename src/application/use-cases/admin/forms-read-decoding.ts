/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How the form admin reads read their raw parameters — the same record whether
 * it came from an HTTP query string or an MCP tool's arguments.
 */

import { Option, Schema } from 'effect'
import { formsSubmissionsListQuerySchema } from '@/domain/models/api/admin/forms'
import type { SubmissionsListInput } from '@/application/use-cases/admin/forms-overview'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** The form the live config declares under `name`, if any. */
export const declaredForm = (app: App, name: unknown): Form | undefined =>
  typeof name === 'string' ? (app.forms ?? []).find((form) => form.name === name) : undefined

export const notFound = { _tag: 'NotFound' } as const

export const invalidQuery = { _tag: 'InvalidInput', reason: 'malformed' } as const

export interface FormsListRequest {
  readonly cursor: string | undefined
  readonly limit: number
  readonly search: string | undefined
}

/** The catalog knobs, read leniently as the route always read them (limit 1..200, else 50). */
export const decodeFormsList = (raw: Readonly<Record<string, unknown>>): FormsListRequest => {
  const limit = Number(raw['limit'] ?? '50')
  const { cursor, search } = raw
  return {
    cursor: typeof cursor === 'string' ? cursor : undefined,
    limit: Number.isFinite(limit) && limit >= 1 && limit <= 200 ? limit : 50,
    search: typeof search === 'string' && search.length > 0 ? search : undefined,
  }
}

/**
 * A form name is lowercase kebab-case, at most 64 characters. A name outside
 * that shape cannot be declared, so it is answered exactly as an undeclared
 * one — never a distinct refusal that would confirm which shapes exist.
 */
export const isFormNameShape = (name: unknown): name is string =>
  typeof name === 'string' && name.length <= 64 && /^[a-z][a-z0-9-]*$/.test(name)

/**
 * Decode one form's submission list. The form is checked BEFORE the query, as
 * the route always did; the query object is an ALLOW-LIST, so an unlisted knob
 * never reaches the read.
 */
export const decodeSubmissionsList = (raw: Readonly<Record<string, unknown>>, app: App) => {
  const form = declaredForm(app, raw['formName'])
  if (form === undefined) return notFound
  return Option.match(
    Schema.decodeUnknownOption(formsSubmissionsListQuerySchema)({
      cursor: raw['cursor'],
      limit: raw['limit'],
      status: raw['status'],
      from: raw['from'],
      to: raw['to'],
      include_deleted: raw['include_deleted'],
      q: raw['q'],
    }),
    {
      onNone: () => invalidQuery,
      onSome: (query) =>
        ({
          _tag: 'Ok',
          input: {
            formName: form.name,
            includeDeleted: query.include_deleted,
            status: query.status,
            from: query.from,
            to: query.to,
            q: query.q,
            cursor: query.cursor,
            limit: query.limit,
          } satisfies SubmissionsListInput,
        }) as const,
    }
  )
}
