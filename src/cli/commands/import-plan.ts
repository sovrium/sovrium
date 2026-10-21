/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — planning a migration: the intermediate models through the
 * mappers, against the config they are written into. Everything here decides;
 * nothing writes. Every refusal a write could hit is made here, so a refused
 * run has written nothing.
 *
 * - **Name clashes are refused, never merged.** A table or automation the
 *   config already holds is refused with the name and `--prefix` — unless the
 *   config already holds exactly what the import would write, which is a
 *   re-run of the same import and changes nothing.
 * - **The whole migrated app is decoded once** — the config with every new
 * entry in place — before anything is written ([internal ref] A14, bound 5).
 */

import { planSeedFiles, type SeedPlan } from '@/domain/models/import/seed-emission-service'
import { planTables, type ConfigEntry } from '@/domain/models/import/table-mapper-service'
import { refuse } from './app-prelude'
import { flowPlanOf, withLibrary } from './import-plan-connections'
import {
  formNamesOf,
  mergeSeeds,
  mergeTableSections,
  planFormPart,
  type FormPart,
} from './import-plan-forms'
import {
  formRenamesOf,
  pageFormsOf,
  planPagePart,
  type MigratedPagesRun,
} from './import-plan-pages'
import { indented } from './library-add-config'
import { validateParsedConfig } from './validate'
import type { SourceRead } from './import-sources'
import type { TableSourceTool } from '@/domain/models/import/field-type-mappings'
import type {
  ExistingConnection,
  LibraryConnection,
  PlannedConnection,
} from '@/domain/models/import/flow-mapper-service'
import type { ImportReport } from '@/domain/models/import/import-report'
import type { ImportDomain, ImportSourceTool } from '@/domain/models/import/import-source'

/** The config entries an import adds, per root key. */
export interface ConfigAdditions {
  readonly tables: readonly ConfigEntry[]
  readonly forms: readonly ConfigEntry[]
  readonly automations: readonly ConfigEntry[]
  readonly connections: readonly ConfigEntry[]
  readonly env: readonly ConfigEntry[]
  readonly pages: readonly ConfigEntry[]
}

/** A planned migration. */
export interface MigrationPlan {
  readonly domains: readonly ImportDomain[]
  readonly additions: ConfigAdditions
  readonly seed: SeedPlan | undefined
  readonly sections: Pick<ImportReport, 'tables' | 'data' | 'automations' | 'forms' | 'pages'>
  /** The library connections the automations use, new and reused, written as `library add` writes them. */
  readonly library: readonly PlannedConnection[]
  /** The env names of every connection the automations use, for `.env.example`. */
  readonly connectionEnv: readonly string[]
  readonly unmapped: ImportReport['unmapped']
  readonly todo: ImportReport['todo']
}

/** What the planner reads besides the source. */
export interface PlanInput {
  readonly tool: ImportSourceTool
  readonly source: SourceRead
  readonly parsed: unknown
  readonly refSources: ReadonlyMap<string, string>
  readonly only: readonly ImportDomain[] | undefined
  readonly prefix: string | undefined
  readonly connection: (slug: string) => LibraryConnection | undefined
  /** A connection the config already holds, by name, and whether it is a library fragment. */
  readonly existing?: (name: string) => ExistingConnection | undefined
  /** What the page converter gave, when the source is a page export. */
  readonly migratedPages?: MigratedPagesRun
}

const TABLE_TOOLS = new Set<string>([
  'airtable',
  'notion',
  'google-sheets',
  'csv',
  'xlsx',
  'baserow',
  'retool-database',
  'webflow',
  'zapier-tables',
  'zite',
])
const FLOW_TOOLS = new Set<string>([
  'n8n',
  'make',
  'zapier',
  'retool-workflows',
  'baserow',
  'webflow',
])

type Json = Readonly<Record<string, unknown>>

const listOf = (parsed: unknown, key: string): readonly Json[] => {
  const items = (parsed as Json | undefined)?.[key]
  return Array.isArray(items)
    ? items.filter((item): item is Json => typeof item === 'object' && item !== null)
    : []
}

const withoutId = (entry: Json): string => {
  const { id: _id, ...rest } = entry
  return JSON.stringify(rest)
}

/**
 * Split planned entries into the ones to add and the ones the config already
 * holds unchanged; a name the config holds with OTHER content is a clash.
 */
const partition = (
  planned: readonly ConfigEntry[],
  existing: readonly Json[],
  identity: (entry: Json) => string
): { readonly add: readonly ConfigEntry[]; readonly clashes: readonly string[] } => {
  const byName = new Map(existing.map((entry) => [String(entry['name']), entry] as const))
  return planned.reduce<{
    readonly add: readonly ConfigEntry[]
    readonly clashes: readonly string[]
  }>(
    (state, entry) => {
      const held = byName.get(String(entry['name']))
      if (held === undefined) return { ...state, add: [...state.add, entry] }
      return identity(held) === identity(entry)
        ? state
        : { ...state, clashes: [...state.clashes, String(entry['name'])] }
    },
    { add: [], clashes: [] }
  )
}

const refuseClashes = (kind: 'table' | 'automation' | 'form', clashes: readonly string[]): void => {
  if (clashes.length === 0) return
  const plural = clashes.length > 1
  refuse(
    `Error: The config already has ${plural ? `${kind}s` : `a ${kind}`} named ${clashes.map((name) => `"${name}"`).join(', ')}, ` +
      'so the import changed nothing.\n\n' +
      `  An import never merges into or overwrites an existing ${kind}. Import under new names with --prefix <p>,\n` +
      `  e.g. --prefix ${kind === 'automation' ? 'n8n-' : 'imported_'}, or rename the existing ${kind} first.`
  )
}

const maxTableId = (parsed: unknown): number =>
  listOf(parsed, 'tables').reduce(
    (max, table) => (typeof table['id'] === 'number' && table['id'] > max ? table['id'] : max),
    0
  )

/** What the table part adds; empty when the source holds no table. */
interface TablePart {
  readonly add: readonly ConfigEntry[]
  readonly seed: SeedPlan | undefined
  readonly tables: ImportReport['tables']
  readonly unmapped: ImportReport['unmapped']
  readonly todo: ImportReport['todo']
}

const NO_TABLES: TablePart = { add: [], seed: undefined, tables: undefined, unmapped: [], todo: [] }

/** A note per seed file keyed by row position: a re-import matches only rows still in order. */
const identityNotes = (seed: SeedPlan | undefined): ImportReport['unmapped'] =>
  (seed?.files ?? [])
    .filter((file) => file.identity === 'row-position')
    .map((file) => ({
      domain: 'data' as const,
      source: `${file.table} records`,
      kind: 'identity' as const,
      reason:
        'The source has no id column, so each record is keyed by its row position: a re-import matches rows only if they stay in the same order.',
      fallback: 'row position',
    }))

/** Plan the tables and their records. */
const planTablePart = (input: PlanInput, domains: readonly ImportDomain[]): TablePart => {
  const read = input.source.tables
  if (read === undefined || !TABLE_TOOLS.has(input.tool)) return NO_TABLES
  const accounts = (input.parsed as Json | undefined)?.['auth'] !== undefined
  // The base names the field-type table: a typed tool's untyped export (a Webflow
  // collection CSV) is read as a CSV, through the inferred types.
  const tool = TABLE_TOOLS.has(read.base.tool) ? read.base.tool : input.tool
  const plan = planTables(read.base, {
    tool: tool as TableSourceTool,
    maxTableId: maxTableId(input.parsed),
    accounts,
    ...(input.prefix === undefined ? {} : { prefix: input.prefix }),
  })
  // With no auth block there is no account to seed: collaborators are kept as text.
  const base = accounts ? read.base : { ...read.base, users: [] }
  const seed = domains.includes('data') ? planSeedFiles(base, plan, read.identities) : undefined
  const notes = read.notes ?? []
  if (!domains.includes('tables'))
    return { ...NO_TABLES, seed, unmapped: [...notes, ...identityNotes(seed)] }
  const split = partition(
    plan.tables.map((table) => table.entry),
    listOf(input.parsed, 'tables'),
    withoutId
  )
  refuseClashes('table', split.clashes)
  return {
    add: split.add,
    seed,
    tables: plan.section,
    unmapped: [...plan.unmapped, ...notes, ...identityNotes(seed)],
    todo: plan.todo,
  }
}

/** Plan the automations, their connections and env names. */
/** What the automations part adds; empty when the source holds no flow. */
interface FlowPart {
  readonly automations: readonly ConfigEntry[]
  /** The catalogue and skeleton connections written in place. */
  readonly connections: readonly ConfigEntry[]
  /** The library connections, written as fragments. */
  readonly library: readonly PlannedConnection[]
  readonly connectionEnv: readonly string[]
  readonly env: readonly ConfigEntry[]
  readonly section: ImportReport['automations']
  readonly unmapped: ImportReport['unmapped']
  readonly todo: ImportReport['todo']
}

const NO_FLOWS: FlowPart = {
  automations: [],
  connections: [],
  library: [],
  connectionEnv: [],
  env: [],
  section: undefined,
  unmapped: [],
  todo: [],
}

/** The automations section of a source that holds none this release reads. */
const noFlowsSection = (input: PlanInput): ImportReport['automations'] => ({
  created: [],
  connections: [],
  env: [],
  neverImportable: input.source.neverImportable ?? [],
})

const planFlowPart = (
  input: PlanInput,
  domains: readonly ImportDomain[],
  tables: TablePart,
  forms: ReadonlyMap<string, string>
): FlowPart => {
  const { flows } = input.source
  if (flows === undefined || !domains.includes('automations')) return NO_FLOWS
  if (flows.length === 0) return { ...NO_FLOWS, section: noFlowsSection(input) }
  if (!FLOW_TOOLS.has(input.tool)) return NO_FLOWS
  const imported = new Map(
    (tables.tables?.created ?? []).map((table) => [table.source, table.name] as const)
  )
  const plan = flowPlanOf(input, flows, imported, forms)
  const split = partition(plan.automations, listOf(input.parsed, 'automations'), (entry) =>
    JSON.stringify(entry)
  )
  refuseClashes('automation', split.clashes)
  const held = new Set(listOf(input.parsed, 'connections').map((entry) => String(entry['name'])))
  const declared = new Set(listOf(input.parsed, 'env').map((entry) => String(entry['key'])))
  return {
    automations: split.add,
    connections: plan.connections
      .filter((one) => one.origin !== 'library' && !one.reused && !held.has(one.name))
      .map((one) => one.entry),
    library: plan.connections.filter((one) => one.origin === 'library'),
    connectionEnv: plan.connections.flatMap((one) => one.env),
    env: plan.env.filter((entry) => !declared.has(String(entry['key']))),
    section: {
      ...plan.section,
      neverImportable: input.source.neverImportable ?? plan.section.neverImportable,
    },
    unmapped: [...plan.unmapped, ...(input.source.flowNotes ?? [])],
    todo: plan.todo,
  }
}

/** The config with the additions in place, as the app would read it. */
export const withAdditions = (parsed: unknown, additions: ConfigAdditions): Json => {
  const root = (parsed ?? {}) as Json
  const extend = (key: keyof ConfigAdditions) =>
    additions[key].length === 0 ? {} : { [key]: [...listOf(root, key), ...additions[key]] }
  return {
    ...root,
    ...extend('tables'),
    ...extend('forms'),
    ...extend('automations'),
    ...extend('connections'),
    ...extend('env'),
    ...extend('pages'),
  }
}

/** The parts the source provides, narrowed by `--only`. */
const domainsOf = (input: PlanInput): readonly ImportDomain[] => {
  const provided: readonly ImportDomain[] = [
    ...(input.source.tables === undefined ? [] : (['tables', 'data'] as const)),
    ...(input.source.flows === undefined ? [] : (['automations'] as const)),
    ...(input.source.forms === undefined ? [] : (['forms', 'data'] as const)),
    ...(input.source.pages === true ? (['pages'] as const) : []),
    ...(pageFormsOf(input.migratedPages).length > 0 ? (['forms'] as const) : []),
  ]
  const { only } = input
  return only === undefined ? provided : provided.filter((domain) => only.includes(domain))
}

/** The report sections of the parts that ran. */
const sectionsOf = (
  tables: TablePart,
  flows: FlowPart,
  forms: FormPart,
  pages: ImportReport['pages']
): MigrationPlan['sections'] => {
  const tableSection = mergeTableSections(tables.tables, forms.tablesSection)
  const seed = mergeSeeds(tables.seed, forms.seed)
  return {
    ...(tableSection === undefined ? {} : { tables: tableSection }),
    ...(seed === undefined ? {} : { data: seed.section }),
    ...(flows.section === undefined ? {} : { automations: flows.section }),
    ...(forms.section === undefined ? {} : { forms: forms.section }),
    ...(pages === undefined ? {} : { pages }),
  }
}

/** The input with the forms the migrated pages hold read as forms of the source. */
const withPageForms = (input: PlanInput): PlanInput => {
  const pageForms = pageFormsOf(input.migratedPages)
  return pageForms.length === 0
    ? input
    : {
        ...input,
        source: { ...input.source, forms: [...(input.source.forms ?? []), ...pageForms] },
      }
}

/** Plan a migration, refusing a clash or a config that would not validate. */
export const planMigration = async (given: PlanInput): Promise<MigrationPlan> => {
  const domains = domainsOf(given)
  const input = withPageForms(given)
  const tables = planTablePart(input, domains)
  const forms = planFormPart(input, domains, refuseClashes, tables.add)
  const formNames = formNamesOf(input, forms)
  const flows = planFlowPart(input, domains, tables, formNames)
  const others: ConfigAdditions = {
    tables: [...tables.add, ...forms.tables],
    forms: forms.forms,
    automations: flows.automations,
    connections: flows.connections,
    env: flows.env,
    pages: [],
  }
  // Pages last: each formRef follows its form's rename, then is judged against
  // the forms the app now holds.
  const pages = planPagePart(
    domains.includes('pages') ? input.migratedPages : undefined,
    input.parsed,
    withAdditions(input.parsed, others),
    formRenamesOf(input.migratedPages, formNames)
  )
  const additions: ConfigAdditions = { ...others, pages: pages.pages }
  const outcome = await validateParsedConfig(
    withLibrary(withAdditions(input.parsed, additions), flows.library),
    input.refSources
  )
  if (outcome.errors.length > 0) {
    return refuse(
      `Error: The migrated app does not validate, so the import changed nothing.\n\n${indented(outcome.errors)}`
    )
  }
  return {
    domains,
    additions,
    seed: mergeSeeds(tables.seed, forms.seed),
    sections: sectionsOf(tables, flows, forms, pages.section),
    library: flows.library,
    connectionEnv: [...new Set(flows.connectionEnv)],
    unmapped: [...tables.unmapped, ...flows.unmapped, ...forms.unmapped],
    todo: [...tables.todo, ...flows.todo, ...forms.todo],
  }
}
