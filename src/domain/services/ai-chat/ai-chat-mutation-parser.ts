/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { findReferencedTable, findSelectOptionMention, QUOTED_RE } from './ai-chat-parsing'

export interface MutationField {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string>
  readonly required?: boolean
}

export interface MutationTable {
  readonly name: string
  readonly fields: ReadonlyArray<MutationField>
}

export type MutationIntent =
  | {
      readonly kind: 'create'
      readonly table: string
      readonly data: Readonly<Record<string, unknown>>
    }
  | {
      readonly kind: 'update'
      readonly table: string
      readonly recordId?: number
      readonly data: Readonly<Record<string, unknown>>
      readonly bulk: boolean
    }
  | {
      readonly kind: 'delete'
      readonly table: string
      readonly filter?: { readonly column: string; readonly value: string }
    }

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/

const PHONE_RE = /\b[\d][\d\s-]{5,}[\d]\b/

const extractEmailValue = (message: string): string | undefined => {
  const wellFormed = message.match(EMAIL_RE)?.[0]
  if (wellFormed !== undefined) return wellFormed
  const quoted = message.match(QUOTED_RE)?.[1]
  if (quoted !== undefined && /not.?valid|invalid|@/i.test(quoted)) return quoted
  const afterEmailWord = message.match(/email\s+(?:is\s+|to\s+|as\s+)?["']?([\w.+@-]+)["']?/i)?.[1]
  return afterEmailWord !== undefined && afterEmailWord !== 'as' ? afterEmailWord : undefined
}

const extractNameValue = (message: string): string | undefined => {
  const afterColon = message.includes(':') ? message.slice(message.indexOf(':') + 1) : message
  const firstSegment = (afterColon.split(',')[0] ?? '').trim()
  return firstSegment.match(/[A-Z][\w]*(?:\s+[A-Z][\w]*)*/)?.[0]
}

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

const parseRecordId = (message: string): number | undefined => {
  const match = message.match(/#(\d+)/)
  return match?.[1] !== undefined ? Number(match[1]) : undefined
}

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

const isBulkPhrase = (lower: string): boolean => /\b(all|every|each)\b/.test(lower)

export const parseMutationIntent = (
  message: string,
  tables: ReadonlyArray<MutationTable>
): MutationIntent | undefined => {
  const lower = message.toLowerCase()
  const table = findReferencedTable(message, tables)
  if (table === undefined) return undefined

  if (/\b(delete|remove|drop)\b/.test(lower)) {
    const option = findSelectOptionMention(message, table.fields)
    return {
      kind: 'delete',
      table: table.name,
      ...(option !== undefined && { filter: { column: option.field, value: option.value } }),
    }
  }

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

  if (/\b(create|add|new|insert)\b/.test(lower)) {
    return {
      kind: 'create',
      table: table.name,
      data: extractCreateData(message, table),
    }
  }

  return undefined
}
