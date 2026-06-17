/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const QUOTED_RE = /["']([^"']+)["']/

export const normaliseSeparators = (raw: string): string => raw.toLowerCase().replace(/[-_]+/g, ' ')

export interface NamedTable {
  readonly name: string
}

export const findReferencedTable = <T extends NamedTable>(
  message: string,
  tables: ReadonlyArray<T>
): T | undefined => {
  const lower = normaliseSeparators(message)
  return tables.find((table) => {
    const name = normaliseSeparators(table.name)
    const singular = name.endsWith('s') ? name.slice(0, -1) : name
    return lower.includes(name) || lower.includes(singular)
  })
}

export interface OptionableField {
  readonly name: string
  readonly options?: ReadonlyArray<string>
}

export interface SelectOptionMention {
  readonly field: string
  readonly value: string
}

const escapeRegExp = (raw: string): string => raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const findSelectOptionMention = (
  message: string,
  fields: ReadonlyArray<OptionableField>
): SelectOptionMention | undefined => {
  const lower = message.toLowerCase()
  return fields
    .flatMap((field) =>
      (field.options ?? [])
        .filter((opt) => new RegExp(`\\b${escapeRegExp(opt.toLowerCase())}\\b`).test(lower))
        .map((value) => ({ field: field.name, value }))
    )
    .at(0)
}
