/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two private links a top-level form can hand its submitter — the resume
 * link of a saved draft (`saveAndResume`) and the edit link of a sent
 * submission (`editAfterSubmit`) — reduced to the pure decisions they share:
 * how long a link lives, which answers a draft keeps, and how a stored ledger
 * row reads back into the form's inputs.
 */

/** The life of a resume link when `saveAndResume.expiresIn` is not declared. */
export const DEFAULT_DRAFT_EXPIRES_IN = '30d'

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const

/**
 * A `<n>m|h|d` duration in milliseconds. The schema admits only that shape, so
 * an unreadable value (never decoded) counts as no time at all, which closes
 * the link rather than leaving it open forever.
 */
export const formLinkWindowMs = (window: string): number => {
  const match = /^(\d+)\s*([mhd])$/.exec(window.trim())
  if (match === null) return 0
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS]
}

/** True while `now` is still inside `window` from `startedAtMs` (epoch milliseconds). */
export const isWithinFormLinkWindow = (
  startedAtMs: number,
  window: string,
  now: number = Date.now()
): boolean => now < startedAtMs + formLinkWindowMs(window)

/** The instant (epoch milliseconds) a link opened at `startedAtMs` stops working. */
export const formLinkExpiry = (startedAtMs: number, window: string): number =>
  startedAtMs + formLinkWindowMs(window)

interface AccessFieldShape {
  readonly kind: string
  readonly column?: string
  readonly name?: string
  readonly inputType?: string
}

interface AccessFormShape {
  readonly fields: ReadonlyArray<AccessFieldShape>
  readonly submitTo: {
    readonly table?: string
    readonly mapping?: Readonly<Record<string, string>>
  }
}

interface AccessTableShape {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

const ATTACHMENT_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
])

/** True when a field takes a file, which a draft never keeps. */
const takesFile = (field: AccessFieldShape, columns: ReadonlyMap<string, string>): boolean => {
  if (field.kind === 'standalone') return field.inputType === 'attachment'
  if (field.kind === 'table-field') {
    return ATTACHMENT_COLUMN_TYPES.has(columns.get(field.column ?? '') ?? '')
  }
  return false
}

/** A value a draft can hold: a scalar, or a list of scalars. */
const isKeepableValue = (value: unknown): boolean => {
  if (value === null) return true
  if (['string', 'number', 'boolean'].includes(typeof value)) return true
  return (
    Array.isArray(value) &&
    value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))
  )
}

/**
 * The answers a draft keeps, keyed by the form's own field names: only fields
 * the form declares a submitter can type into (not calculations, which are
 * recomputed, and not files, which are uploaded only on the final submit), and
 * only plain values. Nothing is validated — a half-filled form is the point.
 */
export const draftableAnswers = (
  form: AccessFormShape,
  tables: ReadonlyArray<AccessTableShape> | undefined,
  answers: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const table = tables?.find((t) => t.name === form.submitTo.table)
  const columns = new Map((table?.fields ?? []).map((field) => [field.name, field.type]))
  const keepable = new Set(
    form.fields.flatMap((field): ReadonlyArray<string> => {
      if (takesFile(field, columns)) return []
      if (field.kind === 'table-field' && field.column !== undefined) return [field.column]
      if (field.kind === 'standalone' && field.name !== undefined) return [field.name]
      return []
    })
  )
  return Object.fromEntries(
    Object.entries(answers).filter(([key, value]) => keepable.has(key) && isKeepableValue(value))
  )
}

/**
 * The files a submission already holds, carried into an edit that picks none:
 * an edit page cannot show a file input its value, so an attachment field left
 * empty keeps what was sent rather than clearing it.
 */
export const keptFileAnswers = (
  form: AccessFormShape,
  tables: ReadonlyArray<AccessTableShape> | undefined,
  stored: Readonly<Record<string, unknown>>,
  edited: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const table = tables?.find((t) => t.name === form.submitTo.table)
  const columns = new Map((table?.fields ?? []).map((field) => [field.name, field.type]))
  const fileNames = form.fields.flatMap((field): ReadonlyArray<string> => {
    if (!takesFile(field, columns)) return []
    return [field.column ?? field.name ?? '']
  })
  return Object.fromEntries(
    fileNames
      .filter((name) => name !== '' && edited[name] === undefined && stored[name] !== undefined)
      .map((name) => [name, stored[name]])
  )
}

/**
 * A stored submission's data read back under the form's own field names: the
 * ledger keeps a renamed field under its `submitTo.mapping` target, so the
 * rename is undone for the inputs to find their values.
 */
export const answersFromLedgerData = (
  form: AccessFormShape,
  data: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const renamedFrom = new Map(
    Object.entries(form.submitTo.mapping ?? {}).map(([field, column]) => [column, field])
  )
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [renamedFrom.get(key) ?? key, value])
  )
}
