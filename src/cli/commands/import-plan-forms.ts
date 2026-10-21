/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — planning the forms of a migration: each form through the
 * one form mapper, its responses table beside it, and its responses through
 * the data path's own seed planner. Like the rest of the plan, it decides and
 * refuses; it writes nothing.
 *
 * A form or a responses table the config already holds with other content is
 * refused by name, never merged; the same content is a re-run and adds nothing.
 */

import { planForms } from '@/domain/models/import/form-mapper-service'
import { planSeedFiles, type SeedPlan } from '@/domain/models/import/seed-emission-service'
import type { PlanInput } from './import-plan'
import type { CanonicalBase } from '@/domain/models/import/canonical-base'
import type { ImportReport } from '@/domain/models/import/import-report'
import type { ImportDomain } from '@/domain/models/import/import-source'
import type { ConfigEntry, TablePlan } from '@/domain/models/import/table-mapper-service'

type Json = Readonly<Record<string, unknown>>

/** What the forms part adds; empty when the source holds no form. */
export interface FormPart {
  readonly forms: readonly ConfigEntry[]
  readonly tables: readonly ConfigEntry[]
  readonly seed: SeedPlan | undefined
  readonly section: ImportReport['forms']
  readonly tablesSection: ImportReport['tables']
  readonly unmapped: ImportReport['unmapped']
  readonly todo: ImportReport['todo']
}

export const NO_FORMS: FormPart = {
  forms: [],
  tables: [],
  seed: undefined,
  section: undefined,
  tablesSection: undefined,
  unmapped: [],
  todo: [],
}

const listOf = (parsed: unknown, key: string): readonly Json[] => {
  const items = (parsed as Json | undefined)?.[key]
  return Array.isArray(items)
    ? items.filter((item): item is Json => typeof item === 'object' && item !== null)
    : []
}

const maxIdOf = (parsed: unknown, key: string, at = 0): number =>
  listOf(parsed, key).reduce(
    (max, entry) => (typeof entry['id'] === 'number' && entry['id'] > max ? entry['id'] : max),
    at
  )

/** The entries to add, and the names the config already holds with other content. */
const split = (
  planned: readonly ConfigEntry[],
  existing: readonly Json[],
  identity: (entry: Json) => string
) => {
  const byName = new Map(existing.map((entry) => [String(entry['name']), entry] as const))
  return {
    add: planned.filter((entry) => !byName.has(String(entry['name']))),
    clashes: planned.flatMap((entry) => {
      const held = byName.get(String(entry['name']))
      return held === undefined || identity(held) === identity(entry) ? [] : [String(entry['name'])]
    }),
  }
}

const withoutId = (entry: Json): string => {
  const { id: _id, ...rest } = entry
  return JSON.stringify(rest)
}

/** The table mapper's view of the responses tables, so the seed planner reads them as it reads any. */
const tablePlanOf = (tables: ReturnType<typeof planForms>['tables']): TablePlan => ({
  tables,
  section: {
    created: tables.map((table) => ({
      name: table.name,
      source: table.source.name,
      fields: table.fields.length + 1,
    })),
    fields: [],
    views: [],
    neverImportable: [],
  },
  unmapped: [],
  todo: [],
})

/** Plan the forms, their responses tables and their responses. */
export const planFormPart = (
  input: PlanInput,
  domains: readonly ImportDomain[],
  refuseClashes: (kind: 'table' | 'form', clashes: readonly string[]) => void,
  plannedTables: readonly ConfigEntry[] = []
): FormPart => {
  const { forms } = input.source
  if (forms === undefined || forms.length === 0 || !domains.includes('forms')) return NO_FORMS
  const plan = planForms(forms, {
    ...(input.prefix === undefined ? {} : { prefix: input.prefix }),
    // Past the tables the same run adds too (a site's CMS collections).
    maxTableId: maxIdOf({ tables: plannedTables }, 'tables', maxIdOf(input.parsed, 'tables')),
    maxFormId: maxIdOf(input.parsed, 'forms'),
  })
  const tablePlan = tablePlanOf(plan.tables)
  const base: CanonicalBase = {
    tool: input.tool,
    sourceId: forms.map((form) => form.sourceId).join(','),
    name: forms[0]?.title ?? 'forms',
    tables: plan.tables.map((table) => table.source),
    users: [],
    neverImportable: [],
  }
  const tables = split(
    plan.tables.map((table) => table.entry),
    listOf(input.parsed, 'tables'),
    withoutId
  )
  refuseClashes('table', tables.clashes)
  const entries = split(plan.forms, listOf(input.parsed, 'forms'), withoutId)
  refuseClashes('form', entries.clashes)
  return {
    forms: entries.add,
    tables: tables.add,
    seed: domains.includes('data') ? planSeedFiles(base, tablePlan, {}) : undefined,
    section: plan.section,
    tablesSection: { ...tablePlan.section, fields: plan.fields },
    unmapped: plan.unmapped,
    todo: plan.todo,
  }
}

/** The form names the plan gives each source form, by the form's source id. */
export const formNamesOf = (input: PlanInput, part: FormPart): ReadonlyMap<string, string> =>
  part.section === undefined
    ? new Map()
    : new Map(
        (input.source.forms ?? []).flatMap((form, index) => {
          const name = part.section?.created[index]?.name
          return name === undefined ? [] : [[form.sourceId, name] as const]
        })
      )

/**
 * One seed plan from the tables' and the forms', for a source that holds both
 * (a Webflow site: its CMS collections and its forms' responses).
 */
export const mergeSeeds = (
  tables: SeedPlan | undefined,
  forms: SeedPlan | undefined
): SeedPlan | undefined => {
  if (tables === undefined || forms === undefined) return tables ?? forms
  const users = [
    ...new Map(
      [...tables.users, ...forms.users].map((user) => [user.email, user] as const)
    ).values(),
  ]
  return {
    files: [...tables.files, ...forms.files],
    users,
    assets: [...tables.assets, ...forms.assets],
    section: {
      tables: [...tables.section.tables, ...forms.section.tables],
      users: users.length,
    },
  }
}

/** One tables section from the tables' and the forms' responses tables. */
export const mergeTableSections = (
  tables: ImportReport['tables'],
  forms: ImportReport['tables']
): ImportReport['tables'] =>
  tables === undefined || forms === undefined
    ? (tables ?? forms)
    : {
        ...tables,
        created: [...tables.created, ...forms.created],
        fields: [...tables.fields, ...forms.fields],
      }
