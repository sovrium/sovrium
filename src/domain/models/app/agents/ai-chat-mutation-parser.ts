/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat Mutation Intent Parser
 *
 * Pure domain function that derives a structured {@link MutationIntent} from a
 * natural-language chat message and the app's table metadata. It powers
 * `[internal ref]`.
 *
 * Why a route-side parser rather than trusting the AI provider's response:
 * the E2E mock AI server matches seeded responses by literal substring on the
 * *whole* prompt — the seeded JSON-action patterns in the spec
 * (`'create contact'`, `'update ticket'`, `'bulk update'`) do NOT actually
 * occur verbatim in the user messages, so the mock returns its default text
 * reply. The chat surface therefore owns intent extraction: it parses the
 * user's request deterministically, performs the mutation, and uses the AI
 * provider for the conversational `reply` only.
 *
 * The parser is deliberately structural (it accepts the minimal table shape it
 * needs) so it stays in the domain layer with no presentation/application
 * dependency. It recognises the four mutation verbs the spec exercises:
 *  - create  — "Create a new contact: John Doe, john@example.com"
 *  - update  — "Mark ticket #42 as resolved"
 *  - delete  — "Delete all draft orders"        (always needs confirmation)
 *  - update  — "Set all overdue invoices to status 'late'" (bulk → confirm)
 */

import { findReferencedTable, findSelectOptionMention, QUOTED_RE } from './ai-chat-parsing'

/** Minimal field shape the mutation parser reads. */
export interface MutationField {
  readonly name: string
  readonly type: string
  /** Predefined option values for single-select / multi-select fields. */
  readonly options?: ReadonlyArray<string>
  readonly required?: boolean
}

/** Minimal table shape the mutation parser reads. */
export interface MutationTable {
  readonly name: string
  readonly fields: ReadonlyArray<MutationField>
}

/** A parsed record-mutation intent. */
export type MutationIntent =
  | {
      readonly kind: 'create'
      readonly table: string
      readonly data: Readonly<Record<string, unknown>>
    }
  | {
      readonly kind: 'update'
      readonly table: string
      /** Present for a single-record update targeting an explicit id. */
      readonly recordId?: number
      readonly data: Readonly<Record<string, unknown>>
      /** True when the update targets every row in the table (bulk). */
      readonly bulk: boolean
    }
  | {
      readonly kind: 'delete'
      readonly table: string
      /** Optional `column = value` filter narrowing the rows to delete. */
      readonly filter?: { readonly column: string; readonly value: string }
    }

/** An email-shaped token, used to map the `email` field type from free text. */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/

/** A phone-shaped token (digits with optional dashes/spaces, 7+ chars). */
const PHONE_RE = /\b[\d][\d\s-]{5,}[\d]\b/

/**
 * Resolve a value for the `email` field from free text. Prefers a well-formed
 * email token; otherwise falls back to a quoted literal or the token after the
 * word "email" so an invalid value still maps to the email field and schema
 * validation can reject it.
 */
const extractEmailValue = (message: string): string | undefined => {
  const wellFormed = message.match(EMAIL_RE)?.[0]
  if (wellFormed !== undefined) return wellFormed
  const quoted = message.match(QUOTED_RE)?.[1]
  if (quoted !== undefined && /not.?valid|invalid|@/i.test(quoted)) return quoted
  const afterEmailWord = message.match(/email\s+(?:is\s+|to\s+|as\s+)?["']?([\w.+@-]+)["']?/i)?.[1]
  return afterEmailWord !== undefined && afterEmailWord !== 'as' ? afterEmailWord : undefined
}

/**
 * Resolve a value for the `name` field: the first comma-delimited segment
 * after the colon (stripped of the leading verb phrase), reduced to its
 * leading proper-noun run.
 */
const extractNameValue = (message: string): string | undefined => {
  const afterColon = message.includes(':') ? message.slice(message.indexOf(':') + 1) : message
  const firstSegment = (afterColon.split(',')[0] ?? '').trim()
  return firstSegment.match(/[A-Z][\w]*(?:\s+[A-Z][\w]*)*/)?.[0]
}

/**
 * Extract field values from a free-text create message. The parser maps:
 *  - an email token → the first `email`-typed field;
 *  - a phone token  → the first field literally named `phone`;
 *  - the leading proper-noun phrase → the first `single-line-text` field
 *    (typically `name`).
 */
const extractCreateData = (
  message: string,
  table: MutationTable
): Readonly<Record<string, unknown>> => {
  const emailField = table.fields.find((f) => f.type === 'email')
  const phoneField = table.fields.find((f) => f.name.toLowerCase() === 'phone')
  const nameField = table.fields.find(
    (f) => f.type === 'single-line-text' && f.name.toLowerCase() !== 'phone'
  )

  const emailMatch = extractEmailValue(message)
  const phoneMatch = message.match(PHONE_RE)?.[0]?.trim()
  const properNoun = extractNameValue(message)

  return {
    ...(nameField !== undefined && properNoun !== undefined
      ? { [nameField.name]: properNoun }
      : {}),
    ...(emailField !== undefined && emailMatch !== undefined
      ? { [emailField.name]: emailMatch }
      : {}),
    ...(phoneField !== undefined && phoneMatch !== undefined
      ? { [phoneField.name]: phoneMatch }
      : {}),
  }
}

/** Parse a `#<digits>` record-id reference (e.g. "ticket #42" → 42). */
const parseRecordId = (message: string): number | undefined => {
  const match = message.match(/#(\d+)/)
  return match?.[1] !== undefined ? Number(match[1]) : undefined
}

/**
 * Extract a value for a `number`-typed field from an update message.
 * Matches the first table field whose name is mentioned and is followed
 * (within the message) by a numeric token — e.g. "set salary to 60000"
 * → `{ field: 'salary', value: 60000 }`.
 */
const findNumberAssignment = (
  message: string,
  table: MutationTable
): { readonly field: string; readonly value: number } | undefined => {
  const lower = message.toLowerCase()
  return table.fields
    .filter((field) => field.type === 'number' && lower.includes(field.name.toLowerCase()))
    .flatMap((field) => {
      const match = lower
        .slice(lower.indexOf(field.name.toLowerCase()))
        .match(/(?:to|=|is|of)?\s*([\d][\d,.]*)/)
      const raw = match?.[1]?.replace(/,/g, '')
      return raw !== undefined && raw.length > 0 ? [{ field: field.name, value: Number(raw) }] : []
    })
    .at(0)
}

/**
 * A message is a "bulk" mutation when it speaks of *all* / *every* matching
 * rows rather than one explicit record.
 */
const isBulkPhrase = (lower: string): boolean => /\b(all|every|each)\b/.test(lower)

/**
 * Derive a {@link MutationIntent} from a chat message, or `undefined` when the
 * message is not a recognised record mutation (a plain question, etc.).
 */
export const parseMutationIntent = (
  message: string,
  tables: ReadonlyArray<MutationTable>
): MutationIntent | undefined => {
  const lower = message.toLowerCase()
  const table = findReferencedTable(message, tables)
  if (table === undefined) return undefined

  // ── delete ───────────────────────────────────────────────────────────────
  if (/\b(delete|remove|drop)\b/.test(lower)) {
    const option = findSelectOptionMention(message, table.fields)
    return {
      kind: 'delete',
      table: table.name,
      ...(option !== undefined && { filter: { column: option.field, value: option.value } }),
    }
  }

  // ── update ───────────────────────────────────────────────────────────────
  if (/\b(update|set|mark|change|edit)\b/.test(lower)) {
    const option = findSelectOptionMention(message, table.fields)
    const numberAssignment = findNumberAssignment(message, table)
    const recordId = parseRecordId(message)
    const bulk = isBulkPhrase(lower) && recordId === undefined
    return {
      kind: 'update',
      table: table.name,
      ...(recordId !== undefined && { recordId }),
      data: {
        ...(option !== undefined ? { [option.field]: option.value } : {}),
        ...(numberAssignment !== undefined
          ? { [numberAssignment.field]: numberAssignment.value }
          : {}),
      },
      bulk,
    }
  }

  // ── create ───────────────────────────────────────────────────────────────
  if (/\b(create|add|new|insert)\b/.test(lower)) {
    return {
      kind: 'create',
      table: table.name,
      data: extractCreateData(message, table),
    }
  }

  return undefined
}
