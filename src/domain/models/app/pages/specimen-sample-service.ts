/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SAMPLE a design-system specimen frame draws a template on, synthesised
 * from configuration alone.
 *
 * A template is documented in the state its users meet: a record editor on a
 * record, an invitation page on a pending invitation, a code step on a sign-in
 * waiting for its code, a history on a few changes. None of those states can
 * come from the instance's data — the design-system surfaces read config, never
 * records or users ([internal ref] A2/A3) — so each is made up here, from the table's
 * own field definitions and the app's own name, and reads as a sample: "Sample
 * title", "Sample person", `sample@example.com`.
 *
 * Pure: no clock, no randomness. A date is a fixed day, so a frame draws the
 * same document every time it is opened.
 */

/** The slice of a table field a sample value is chosen from. */
export interface SpecimenFieldShape {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string | { readonly value?: string }>
}

/** The id every sample record carries, and the value a frame's route parameter takes. */
export const SPECIMEN_RECORD_ID = 1

/** The person a sample names — never the caller, never a user of the instance. */
export const SPECIMEN_PERSON = { name: 'Sample person', email: 'sample@example.com' } as const

/** The fixed day every sample date falls on. */
const SAMPLE_DAY = '2026-03-12'

/**
 * The instant a specimen is drawn at, on the sample day: its "today" and its
 * "now", whatever clock the environment sets, so one config always draws the
 * same bytes.
 */
export const SPECIMEN_INSTANT: Readonly<Date> = new Date(`${SAMPLE_DAY}T10:00:00.000Z`)

/** A field name as a reader writes it: `due_date` → `due date`. */
const words = (name: string): string =>
  name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()

/** The first declared option of a select-like field, else a sample word. */
const firstOption = (field: SpecimenFieldShape): string => {
  const option = field.options?.[0]
  if (option === undefined) return `Sample ${words(field.name)}`
  return typeof option === 'string' ? option : (option.value ?? `Sample ${words(field.name)}`)
}

/** Sample values that do not depend on the field, by field type. */
const BY_TYPE: Readonly<Record<string, unknown>> = {
  integer: 3,
  autonumber: SPECIMEN_RECORD_ID,
  decimal: 12.5,
  currency: 1200,
  percentage: 40,
  progress: 40,
  rating: 4,
  duration: 3600,
  checkbox: true,
  date: SAMPLE_DAY,
  'date-time': `${SAMPLE_DAY}T09:30:00.000Z`,
  'created-at': `${SAMPLE_DAY}T09:30:00.000Z`,
  'updated-at': `${SAMPLE_DAY}T09:30:00.000Z`,
  email: SPECIMEN_PERSON.email,
  url: 'https://example.com',
  'phone-number': '+33 1 23 45 67 89',
}

/** Text-bearing types: the field's own name, marked as a sample. */
const TEXT_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'markdown',
])

/**
 * The sample value of one field, or `undefined` for a type a sample cannot
 * honestly fill — a relation, a person, a file, a computed value — which the
 * frame then draws empty, as a new record's would be.
 */
export const sampleValueOf = (field: SpecimenFieldShape): unknown => {
  if (field.type === 'single-select' || field.type === 'status') return firstOption(field)
  if (field.type === 'multi-select') return [firstOption(field)]
  if (TEXT_TYPES.has(field.type)) return `Sample ${words(field.name)}`
  return BY_TYPE[field.type]
}

/** A sample record of a table: its id, and one sample value per field a sample can fill. */
export const specimenRecord = (
  fields: ReadonlyArray<SpecimenFieldShape>
): Readonly<Record<string, unknown>> => ({
  id: SPECIMEN_RECORD_ID,
  ...Object.fromEntries(
    fields.flatMap((field) => {
      const value = sampleValueOf(field)
      return value === undefined ? [] : [[field.name, value] as const]
    })
  ),
})

/**
 * A sample record's change history, newest first, in the shape the records
 * history endpoint answers: who, what, when.
 */
export const specimenHistory = (): readonly Readonly<Record<string, unknown>>[] =>
  (['update', 'update', 'create'] as const).map((action, index) => ({
    action,
    userName: SPECIMEN_PERSON.name,
    createdAt: `${SAMPLE_DAY}T${String(16 - index * 3).padStart(2, '0')}:00:00.000Z`,
  }))

/** Whether an endpoint is a record's change history (`/api/tables/<t>/records/<id>/history`). */
export const isRecordHistoryEndpoint = (endpoint: string): boolean =>
  /^\/api\/tables\/[^/]+\/records\/[^/]+\/history(?:\?.*)?$/.test(endpoint)

/** A sample invitation still waiting for its answer, as the invitation page reads one. */
export const specimenInvitation = () =>
  ({
    inviterName: SPECIMEN_PERSON.name,
    inviterImage: '',
    email: 'invitee@example.com',
    role: 'member',
    expiresAt: `${SAMPLE_DAY}T09:30:00.000Z`,
    accountExists: false,
    status: 'pending',
  }) as const
