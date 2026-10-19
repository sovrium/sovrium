/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a related section's inline create writes, and how its answer is read.
 *
 * Each column the form draws is an entry of the related table exactly as an
 * editable drawer of that table holds it (`RecordDrawerField`), so a value is
 * sent the way that drawer sends it (`toEntryWireValue`) — a date as its ISO
 * day, a cleared link as `null`, a list as a list — and a number as a number.
 *
 * A refusal the records API pins to fields the form draws is kept per field,
 * so the form says why on that field; any other failure is the one designed
 * sentence, never the response body.
 */

import { useRef, useState, type FormEvent } from 'react'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { readFieldErrors } from '../runtime/write-refusal'
import { isStructured, type RecordDrawerField } from './record-drawer-field'
import { toEntryWireValue, type Values } from './record-drawer-values'
import type { RelatedSection } from './record-drawer-related'

/** Column types nobody writes: computed, stamped, or an action. */
const NOT_WRITABLE: ReadonlySet<string> = new Set([
  'formula',
  'lookup',
  'rollup',
  'count',
  'autonumber',
  'created-at',
  'updated-at',
  'created-by',
  'updated-by',
  'button',
])

/** Whether the inline create draws a control for an entry. */
const isWritable = (entry: RecordDrawerField): boolean =>
  entry.readOnly !== true &&
  !NOT_WRITABLE.has(entry.type) &&
  !isStructured(entry) &&
  // A link is written through its picker, which needs the related table.
  (entry.type !== 'relationship' || entry.relatedTable !== undefined)

/**
 * The entries the create form draws: every column the section shows except
 * the link back to the opened record (set for the reader) and a column nobody
 * — or not this reader — writes.
 */
export function relatedCreateEntries(section: RelatedSection): readonly RecordDrawerField[] {
  return section.columns
    .filter((column) => column.field !== section.field)
    .map((column) => ({
      ...column.control,
      name: column.field,
      type: column.type,
      label: column.label,
    }))
    .filter(isWritable)
}

/** The value an entry sends: the drawer's own, and a number as a number. */
function wireValueOf(entry: RecordDrawerField, values: Values): unknown {
  const value = toEntryWireValue(entry, values)
  if (fieldWidgetOf(entry.type) !== 'number' || typeof value !== 'string') return value
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}

/** Why a create was refused: per field the form draws, or only that it failed. */
export type CreateRefusal =
  | { readonly kind: 'none' }
  | { readonly kind: 'fields'; readonly fields: Readonly<Record<string, string>> }
  | { readonly kind: 'failed' }

const NO_REFUSAL: CreateRefusal = { kind: 'none' }

/** The refusal of a 4xx answer, per field when it names fields the form draws. */
function refusalOf(
  status: number,
  body: unknown,
  entries: readonly RecordDrawerField[]
): CreateRefusal {
  const named = status < 500 ? readFieldErrors(body) : undefined
  const drawn = new Set(entries.map((entry) => entry.name))
  const fields = Object.entries(named ?? {}).filter(([name]) => drawn.has(name))
  return fields.length === 0
    ? { kind: 'failed' }
    : { kind: 'fields', fields: Object.fromEntries(fields) }
}

/** POST the filled values plus the link back to the opened record. */
async function createRelatedRecord(
  section: RelatedSection,
  entries: readonly RecordDrawerField[],
  values: Values,
  linkValue: string | number
): Promise<CreateRefusal> {
  const filled = entries.filter((entry) => (values[entry.name] ?? '').trim() !== '')
  const fields = Object.fromEntries(filled.map((entry) => [entry.name, wireValueOf(entry, values)]))
  const response = await fetch(`/api/tables/${encodeURIComponent(section.table)}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, [section.field]: linkValue }),
  })
  if (response.ok) return NO_REFUSAL
  const body: unknown = await response.json().catch(() => undefined)
  return refusalOf(response.status, body, entries)
}

/**
 * The create's submit, held in flight from the press to the answer: a second
 * press or Enter meanwhile sends nothing, so one Save is one create. A refused
 * create keeps the form open with what was typed.
 */
export function useRelatedCreateSubmit(create: {
  readonly section: RelatedSection
  readonly entries: readonly RecordDrawerField[]
  readonly values: Values
  readonly linkValue: string | number
  readonly onDone: (created: boolean) => void
}) {
  const { section, entries, values, linkValue, onDone } = create
  const [refusal, setRefusal] = useState<CreateRefusal>(NO_REFUSAL)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    void createRelatedRecord(section, entries, values, linkValue)
      .catch((): CreateRefusal => ({ kind: 'failed' }))
      .then((outcome) => {
        inFlight.current = false
        setPending(false)
        setRefusal(outcome)
        if (outcome.kind === 'none') onDone(true)
      })
  }
  return { refusal, pending, onSubmit }
}
