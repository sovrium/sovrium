/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  AdminFormsRepository,
  type AdminFormAggregateRow,
  type AdminFormSubmissionRow,
  type AdminFormsDatabaseError,
} from '@/application/ports/repositories/admin-forms-repository'
import {
  formAdminDetailResponseSchema,
  formsListResponseSchema,
  type FormAdminItem,
} from '@/domain/models/api/admin/forms/list'
import { formSubmissionDetailResponseSchema } from '@/domain/models/api/admin/forms/submission-detail'
import { formsSubmissionsBulkResponseSchema } from '@/domain/models/api/admin/forms/submissions-bulk'
import {
  formsSubmissionsListResponseSchema,
  type FormSubmissionAdminItem,
  type FormSubmissionStatus,
} from '@/domain/models/api/admin/forms/submissions-list'
import { AdminFormsRepositoryLive } from '@/infrastructure/database/repositories/admin-forms-repository-live'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'



function resolveAccessLevel(form: Form): 'public' | 'authenticated' | 'role-restricted' {
  const require = form.access?.require
  if (require === undefined || require === 'all') return 'public'
  if (require === 'authenticated') return 'authenticated'
  return 'role-restricted'
}

function resolveIsOpen(form: Form): boolean {
  const { availability } = form
  if (!availability) return true
  const now = Date.now()
  if (availability.opensAt) {
    const opens = Date.parse(availability.opensAt)
    if (!Number.isNaN(opens) && now < opens) return false
  }
  if (availability.closesAt) {
    const closes = Date.parse(availability.closesAt)
    if (!Number.isNaN(closes) && now >= closes) return false
  }
  return true
}

function aggregateLastSubmissionIso(raw: Readonly<Date> | string | null): string | null {
  if (raw === null) return null
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

function buildFormAdminItem(
  form: Form,
  aggregate: AdminFormAggregateRow
): FormAdminItem {
  const submissionCount = Number(aggregate.submissionCount ?? 0)
  const lastSubmissionAt = aggregateLastSubmissionIso(aggregate.lastSubmissionAt ?? null)

  return {
    id: form.id,
    name: form.name,
    title: form.title,
    ...(form.path !== undefined ? { path: form.path } : {}),
    accessLevel: resolveAccessLevel(form),
    isOpen: resolveIsOpen(form),
    _admin: {
      lastModifiedBy: null,
      deletedAt: null,
      metadata: {
        fieldCount: form.fields.length,
        submissionCount,
        lastSubmissionAt,
      },
    },
  }
}


export function encodeFormsCursor(afterName: string): string {
  return Buffer.from(JSON.stringify({ afterName }), 'utf8').toString('base64')
}

export function decodeFormsCursor(
  cursor: string,
  forms: ReadonlyArray<{ readonly name: string }>
): number {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly afterName?: unknown
    }
    if (typeof decoded.afterName !== 'string') return 0
    const idx = forms.findIndex((f) => f.name === decoded.afterName)
    return idx === -1 ? 0 : idx + 1
  } catch {
    return 0
  }
}


function coerceStatus(raw: unknown): FormSubmissionStatus {
  if (
    raw === 'received' ||
    raw === 'processing' ||
    raw === 'done' ||
    raw === 'failed' ||
    raw === 'spam'
  ) {
    return raw
  }
  return 'received'
}

function buildSubmissionAdminItem(
  row: AdminFormSubmissionRow,
  formName: string
): FormSubmissionAdminItem {
  const submittedAt =
    row.submittedAt instanceof Date
      ? row.submittedAt.toISOString()
      : new Date(row.submittedAt).toISOString()
  const deletedAt =
    row.deletedAt === null || row.deletedAt === undefined
      ? null
      : row.deletedAt instanceof Date
        ? row.deletedAt.toISOString()
        : new Date(row.deletedAt).toISOString()
  return {
    id: row.id,
    formName: row.formName ?? formName,
    submittedAt,
    status: coerceStatus(row.status),
    _admin: {
      lastModifiedBy: null,
      deletedAt,
    },
  }
}


export function encodeSubmissionsCursor(submittedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ submittedAt, id }), 'utf8').toString('base64')
}

export function decodeSubmissionsCursor(
  cursor: string
): { readonly submittedAt: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly submittedAt?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.submittedAt !== 'string' || typeof decoded.id !== 'string') return null
    return { submittedAt: decoded.submittedAt, id: decoded.id }
  } catch {
    return null
  }
}


export interface FormsListInput {
  readonly cursor?: string | undefined
  readonly limit: number
  readonly search?: string | undefined
}

export type FormsBuildOutcome<B> =
  | { readonly _tag: 'Ok'; readonly body: B }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export type FormsDetailOutcome<B> = FormsBuildOutcome<B> | { readonly _tag: 'NotFound' }

export const BuildFormsList = (
  app: App,
  input: FormsListInput
): Effect.Effect<
  FormsBuildOutcome<{
    readonly items: readonly FormAdminItem[]
    readonly nextCursor: string | null
  }>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const allForms: readonly Form[] = (app.forms ?? []).slice()
    const sortedForms = allForms.toSorted((a, b) => a.name.localeCompare(b.name))

    const filtered = input.search
      ? sortedForms.filter((f) => {
          const haystack = `${f.name} ${f.title}`.toLowerCase()
          return haystack.includes(input.search!.toLowerCase())
        })
      : sortedForms

    const startIndex = input.cursor ? decodeFormsCursor(input.cursor, filtered) : 0
    const pageSlice = filtered.slice(startIndex, startIndex + input.limit)
    const nextStart = startIndex + pageSlice.length
    const lastForm = pageSlice[pageSlice.length - 1]
    const nextCursor =
      nextStart < filtered.length && lastForm !== undefined
        ? encodeFormsCursor(lastForm.name)
        : null

    const items = yield* Effect.all(
      pageSlice.map((form) =>
        repo.aggregateForForm(form.name).pipe(Effect.map((agg) => buildFormAdminItem(form, agg)))
      ),
      { concurrency: 'unbounded' }
    )

    const body = { items, nextCursor }
    const parsed = formsListResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor } }
  })

export const BuildFormDetail = (
  app: App,
  formName: string
): Effect.Effect<
  FormsDetailOutcome<FormAdminItem>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const form = (app.forms ?? []).find((f) => f.name === formName)
    if (!form) {
      return { _tag: 'NotFound' } as const
    }

    const aggregate = yield* repo.aggregateForForm(form.name)
    const item = buildFormAdminItem(form, aggregate)
    const parsed = formAdminDetailResponseSchema.safeParse(item)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data }
  })


export interface SubmissionsListInput {
  readonly formName: string
  readonly includeDeleted: boolean
  readonly status?: FormSubmissionStatus | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

export const BuildSubmissionsList = (
  input: SubmissionsListInput
): Effect.Effect<
  FormsBuildOutcome<{
    readonly items: readonly FormSubmissionAdminItem[]
    readonly nextCursor: string | null
  }>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const decoded = input.cursor ? decodeSubmissionsCursor(input.cursor) : null
    const cursorBefore = decoded !== null ? new Date(decoded.submittedAt) : undefined

    const rows = yield* repo.listSubmissions({
      formName: input.formName,
      includeDeleted: input.includeDeleted,
      status: input.status,
      from: input.from !== undefined ? new Date(input.from) : undefined,
      to: input.to !== undefined ? new Date(input.to) : undefined,
      cursorBefore,
      limit: input.limit,
    })

    const pageRows = rows.slice(0, input.limit)
    const items = pageRows.map((row) => buildSubmissionAdminItem(row, input.formName))
    const lastItem = items[items.length - 1]
    const nextCursor =
      rows.length > input.limit && lastItem !== undefined
        ? encodeSubmissionsCursor(lastItem.submittedAt, lastItem.id)
        : null

    const body = { items, nextCursor }
    const parsed = formsSubmissionsListResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor } }
  })


export type FormSubmissionDetailItem = FormSubmissionAdminItem & {
  readonly body?: Record<string, unknown>
}

export type SubmissionDetailOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: FormSubmissionDetailItem
      readonly bodyRevealed: boolean
    }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'RevealDenied' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export interface SubmissionDetailInput {
  readonly formName: string
  readonly submissionId: string
  readonly reveal: boolean
  readonly captureAllowed: boolean
  readonly isAdmin: boolean
}

export const BuildSubmissionDetail = (
  input: SubmissionDetailInput
): Effect.Effect<SubmissionDetailOutcome, AdminFormsDatabaseError, AdminFormsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const row = yield* repo.findSubmissionDetail(input.formName, input.submissionId)
    if (row === undefined) {
      return { _tag: 'NotFound' } as const
    }

    if (input.reveal && (!input.captureAllowed || !input.isAdmin)) {
      return { _tag: 'RevealDenied' } as const
    }
    const bodyToInclude: Record<string, unknown> | undefined = input.reveal
      ? ((row.data ?? {}) as Record<string, unknown>)
      : undefined

    const item = buildSubmissionAdminItem(row, input.formName)
    const withBody: FormSubmissionDetailItem =
      bodyToInclude !== undefined ? { ...item, body: bodyToInclude } : item

    const parsed = formSubmissionDetailResponseSchema.safeParse(withBody)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: parsed.data as FormSubmissionDetailItem,
      bodyRevealed: bodyToInclude !== undefined,
    }
  })


export const BuildSubmissionsBulk = (
  formName: string,
  ids: readonly string[]
): Effect.Effect<
  FormsBuildOutcome<{ readonly items: readonly FormSubmissionAdminItem[] }>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const rows = yield* repo.findSubmissionsByIds(formName, ids)

    const byId = new Map(rows.map((row) => [row.id, buildSubmissionAdminItem(row, formName)]))
    const items = ids
      .map((id) => byId.get(id))
      .filter((item): item is FormSubmissionAdminItem => item !== undefined)

    const body = { items }
    const parsed = formsSubmissionsBulkResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { items: parsed.data.items } }
  })


export const AdminFormsLayer = Layer.mergeAll(AdminFormsRepositoryLive)
