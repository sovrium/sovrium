/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — choosing the tool an input came from, and reading it
 * through that tool's adapter into the intermediate models.
 *
 * Detection follows `design-system import`: `--from` wins; otherwise the input
 * must match exactly one tool, and zero or two matches are refused with the
 * accepted `--from` values. A snapshot names its tool in its manifest.
 *
 * The adapters registered here are the ones this release ships. A tool the
 * vocabulary names but no adapter reads yet is refused by name rather than
 * converted into an empty app.
 */

import { extname } from 'node:path'
import {
  autoDelimiter,
  decodeCsvBytes,
  parseCsvDocument,
} from '@/application/use-cases/automations/action-handlers/file-csv'
import { readXlsx } from '@/application/use-cases/automations/action-handlers/file-xlsx-parse'
import { readZipDirectory } from '@/application/use-cases/automations/action-handlers/file-zip-read'
import { adaptAirtableSnapshot } from '@/domain/models/import/airtable-adapter-service'
import {
  adaptWebflowCollectionCsv,
  adaptZapierTablesCsv,
} from '@/domain/models/import/csv-export-adapter-service'
import { adaptFilloutSnapshot } from '@/domain/models/import/fillout-adapter-service'
import { adaptGoogleFormsSnapshot } from '@/domain/models/import/google-forms-adapter-service'
import { detectImportTools } from '@/domain/models/import/import-detection-service'
import { adaptJotformSnapshot } from '@/domain/models/import/jotform-adapter-service'
import { adaptMakeExport } from '@/domain/models/import/make-adapter-service'
import { adaptMicrosoftFormsGrid } from '@/domain/models/import/microsoft-forms-adapter-service'
import {
  adaptN8nSnapshot,
  adaptN8nWorkflows,
} from '@/domain/models/import/n8n-snapshot-adapter-service'
import { adaptNotionSnapshot } from '@/domain/models/import/notion-adapter-service'
import { adaptRetoolDatabaseSnapshot } from '@/domain/models/import/retool-database-adapter-service'
import { adaptRetoolWorkflow } from '@/domain/models/import/retool-workflow-adapter-service'
import { adaptSheetsSnapshot } from '@/domain/models/import/sheets-adapter-service'
import { adaptTabularGrid } from '@/domain/models/import/tabular-adapter-service'
import { adaptTallySnapshot } from '@/domain/models/import/tally-adapter-service'
import { adaptTypeformSnapshot } from '@/domain/models/import/typeform-adapter-service'
import { adaptZiteSnapshot } from '@/domain/models/import/zite-adapter-service'
import { refuse } from './app-prelude'
import { readBaserowSnapshot, readBaserowZip } from './import-baserow'
import { firstRaw, type ImportInput } from './import-input'
import { refuseUnreadRetoolExport } from './import-page-deferrals'
import { TOOL_LIST } from './import-request'
import { readWebflowSite } from './import-webflow'
import { readZapier } from './import-zapier'
import type { CanonicalFlow } from '@/domain/models/import/canonical-flow'
import type { CanonicalForm } from '@/domain/models/import/canonical-form'
import type { ImportReport } from '@/domain/models/import/import-report'
import type { ImportSourceTool } from '@/domain/models/import/import-source'
import type { TableAdapterResult } from '@/domain/models/import/tabular-adapter-service'

/** What an adapter read. */
export interface SourceRead {
  readonly tables?: TableAdapterResult
  readonly flows?: readonly CanonicalFlow[]
  /** The forms, each with its responses. */
  readonly forms?: readonly CanonicalForm[]
  /** True when the input is a page export, handed to the page converter. */
  readonly pages?: boolean
  /** What the flows' report adds: a state in the source, where a flow now fires from. */
  readonly flowNotes?: ImportReport['unmapped']
  /** What the source holds that no export exposes. */
  readonly neverImportable?: readonly { readonly what: string; readonly reason: string }[]
  /**
   * Attachment bytes read from inside the export file itself (a Baserow ZIP),
   * by snapshot asset path; a fetched snapshot holds its own under `assets/`.
   */
  readonly assets?: ReadonlyMap<string, Uint8Array>
}

/** The ZIP entries a probe may list: a page export is never this large. */
const MAX_ZIP_ENTRIES = 50_000

const parseJson = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    // Not JSON: detection simply finds no JSON-shaped tool.
    return undefined
  }
}

const zipEntriesOf = (bytes: Uint8Array): readonly string[] | undefined => {
  const directory = readZipDirectory(bytes)
  if (directory === undefined || directory.length > MAX_ZIP_ENTRIES) return undefined
  return directory.map((entry) => entry.name)
}

/** The header row of a CSV file: its first line, parsed. */
const csvHeaderOf = (bytes: Uint8Array): readonly string[] => {
  const text = decodeCsvBytes(bytes.subarray(0, 64 * 1024))
  const line = text.split(/\r?\n/, 1)[0] ?? ''
  const [header = []] = parseCsvDocument(line, autoDelimiter(line)) ?? []
  return header.map(String)
}

/** The tools an export file's shape matches. */
const detectedTools = (input: ImportInput): readonly ImportSourceTool[] => {
  const raw = firstRaw(input)
  const extension = extname(raw?.name ?? '').toLowerCase()
  const bytes = raw?.bytes ?? new Uint8Array()
  return detectImportTools({
    extension,
    ...(extension === '.json' ? { json: parseJson(bytes) } : {}),
    ...(extension === '.zip' ? { zipEntries: zipEntriesOf(bytes) ?? [] } : {}),
    ...(extension === '.csv' ? { csvHeader: csvHeaderOf(bytes) } : {}),
  })
}

/** The tool an input is read as, and whether `--from` chose it. */
export const chooseTool = (
  input: ImportInput,
  from: ImportSourceTool | undefined
): { readonly tool: ImportSourceTool; readonly forced: boolean } => {
  if (from !== undefined) return { tool: from, forced: true }
  if (input.manifest !== undefined) return { tool: input.manifest.tool, forced: false }
  const tools = detectedTools(input)
  if (tools.length > 1) {
    return refuse(
      `Error: "${input.display}" matches more than one tool: ${tools.join(', ')}.\n\n` +
        `  Name the one it is with --from, e.g. --from ${tools[0] ?? ''}.`
    )
  }
  const [tool] = tools
  return tool === undefined
    ? refuse(
        `Error: "${input.display}" is not an export the import recognises.\n\n` +
          `  Accepted --from values: ${TOOL_LIST}.\n` +
          '  Pass a snapshot written by `sovrium import fetch` or the export file the tool gave you, or name its tool with --from.'
      )
    : { tool, forced: false }
}

/** The rows of a CSV export file. */
const csvRows = (input: ImportInput): ReadonlyArray<ReadonlyArray<string>> => {
  const raw = firstRaw(input)
  if (raw === undefined) return refuse(`Error: "${input.display}" holds no file to read.`)
  const text = decodeCsvBytes(raw.bytes)
  const rows = parseCsvDocument(text, autoDelimiter(text))
  return (
    rows ??
    refuse(`Error: "${input.display}" cannot be read as CSV: a quoted field is never closed.`)
  )
}

/** The rows of an xlsx export file's first sheet. */
const xlsxRows = (input: ImportInput) => {
  const raw = firstRaw(input)
  if (raw === undefined) return refuse(`Error: "${input.display}" holds no file to read.`)
  const read = readXlsx(raw.bytes, undefined)
  if (!read.ok) return refuse(`Error: "${input.display}" cannot be read as xlsx: ${read.message}.`)
  return read.parsed.rows
}

const readGrid = (input: ImportInput, tool: 'csv' | 'xlsx'): TableAdapterResult =>
  tool === 'csv'
    ? adaptTabularGrid('csv', input.stem, csvRows(input))
    : adaptTabularGrid('xlsx', input.stem, xlsxRows(input))

/**
 * A Microsoft Forms responses workbook (or its CSV): the only thing Microsoft
 * Forms exports, so the form is inferred from its columns.
 */
const readMicrosoftForms = (input: ImportInput): SourceRead => {
  if (input.kind === 'file' && input.exportKind === 'csv') {
    return { forms: [adaptMicrosoftFormsGrid(input.stem, csvRows(input))] }
  }
  if (input.kind === 'file' && input.exportKind === 'xlsx') {
    return { forms: [adaptMicrosoftFormsGrid(input.stem, xlsxRows(input))] }
  }
  return refuse(
    `Error: "${input.display}" is not a Microsoft Forms responses workbook.\n\n` +
      '  Open the form\'s responses, choose "Open results in Excel", download the workbook and give that .xlsx file to `sovrium import` with --from microsoft-forms.'
  )
}

/** A Jotform snapshot; Jotform's definition spans several API answers, so only a fetch is read. */
const readJotform = (input: ImportInput): SourceRead =>
  input.kind === 'snapshot'
    ? { forms: [adaptJotformSnapshot(parsedRaw(input))] }
    : refuse(
        `Error: "${input.display}" is not a Jotform snapshot.\n\n` +
          '  Fetch the form first with `sovrium import fetch jotform:<formId>`.'
      )

const readN8nFiles = (input: ImportInput): SourceRead => {
  const documents = [...input.raw.values()].map(parseJson)
  if (documents.some((document) => document === undefined)) {
    return refuse(`Error: "${input.display}" cannot be read as an n8n export: it is not JSON.`)
  }
  const read = adaptN8nWorkflows(documents)
  return { flows: read.flows, flowNotes: read.notes }
}

/** A blueprint file, or a snapshot's blueprints and scenario list pages. */
const readMake = (input: ImportInput): readonly CanonicalFlow[] => {
  const documents = [...input.raw.entries()].map(([path, bytes]) => ({
    path,
    json: parseJson(bytes),
  }))
  if (documents.some((document) => document.json === undefined)) {
    return refuse(`Error: "${input.display}" cannot be read as a Make blueprint: it is not JSON.`)
  }
  const flows = adaptMakeExport(documents)
  return flows.length > 0
    ? flows
    : refuse(`Error: "${input.display}" holds no Make scenario blueprint.`)
}

/** A Retool workflow "Export to JSON" file; the Retool API never returns a workflow's blocks. */
const readRetoolWorkflow = (input: ImportInput): SourceRead => {
  const raw = firstRaw(input)
  const read = adaptRetoolWorkflow(raw === undefined ? undefined : parseJson(raw.bytes))
  return read === undefined
    ? refuse(
        `Error: "${input.display}" is not a Retool workflow export.\n\n` +
          '  Open the workflow in Retool, open its menu, choose Export to JSON, and give that file to `sovrium import`.'
      )
    : { flows: [read.flow], flowNotes: read.notes }
}

/** Every `raw/` file of a snapshot parsed as JSON; a file that is not JSON is refused. */
const parsedRaw = (input: ImportInput): ReadonlyMap<string, unknown> =>
  new Map(
    [...input.raw.entries()].map(([path, bytes]) => {
      const parsed = parseJson(bytes)
      return parsed === undefined
        ? refuse(`Error: "${input.display}/${path}" is not the JSON the fetch wrote.`)
        : ([path, parsed] as const)
    })
  )

/** An export file of one or more workflows, or a snapshot of an instance's. */
const readN8n = (input: ImportInput): SourceRead => {
  if (input.kind === 'snapshot' && input.exportKind === 'api') {
    const read = adaptN8nSnapshot(parsedRaw(input))
    return { flows: read.flows, flowNotes: read.notes }
  }
  return readN8nFiles(input)
}

/**
 * An Airtable snapshot: its tables, and its automations named as not yet
 * importable. Only a snapshot is read; Airtable has no base export file.
 */
const readAirtable = (input: ImportInput): SourceRead => {
  if (input.kind !== 'snapshot') {
    return refuse(
      `Error: "${input.display}" is not an Airtable snapshot. Airtable has no base export file.\n\n` +
        '  Fetch the base first with `sovrium import fetch airtable:<baseId>`.'
    )
  }
  const [baseId = input.stem] = input.manifest?.source.ids ?? []
  const read = adaptAirtableSnapshot({ baseId, files: parsedRaw(input) })
  return { tables: read, flows: [], neverImportable: read.automationsNeverImportable }
}

/** A Zapier Tables CSV download; Zapier Tables has no API this release fetches. */
const readZapierTables = (input: ImportInput): SourceRead =>
  input.exportKind === 'csv' && input.kind === 'file'
    ? { tables: adaptZapierTablesCsv(input.stem, csvRows(input)) }
    : refuse(
        `Error: "${input.display}" is not a Zapier Tables CSV download.\n\n` +
          '  Download the table as CSV from its page (menu, then Download) and give that file to `sovrium import`.'
      )

/** The first id a snapshot's manifest names, else the folder name. */
const firstIdOf = (input: ImportInput): string => input.manifest?.source.ids[0] ?? input.stem

/**
 * A Webflow site snapshot, or a collection CSV export read untyped. Anything
 * else falls through: a site-export ZIP is pages.
 */
const readWebflow = (input: ImportInput): SourceRead | undefined => {
  if (input.kind === 'snapshot' && input.exportKind === 'api') {
    return readWebflowSite(firstIdOf(input), parsedRaw(input), input.manifest?.domains ?? [])
  }
  return input.exportKind === 'csv'
    ? { tables: adaptWebflowCollectionCsv(input.stem, csvRows(input)) }
    : undefined
}

/** A Zite database snapshot; Zite has no export file, so only a fetch is read. */
const readZite = (input: ImportInput): SourceRead => {
  if (input.kind !== 'snapshot') {
    return refuse(
      `Error: "${input.display}" is not a Zite snapshot. Zite has no database export file.\n\n` +
        '  Fetch the database first with `sovrium import fetch zite:<databaseId>`.'
    )
  }
  const read = adaptZiteSnapshot({ databaseId: firstIdOf(input), files: parsedRaw(input) })
  return { tables: read, flows: [], neverImportable: read.base.neverImportable }
}

/** A form snapshot, or the form definition file the tool exported. */
const readForm = (
  input: ImportInput,
  adapt: (files: ReadonlyMap<string, unknown>) => CanonicalForm
): SourceRead => {
  if (input.kind === 'file' && input.exportKind !== 'json') {
    return refuse(
      `Error: "${input.display}" is not a form definition. Pass the JSON of the form, or a snapshot written by \`sovrium import fetch\`.`
    )
  }
  return { forms: [adapt(parsedRaw(input))] }
}

/**
 * A Notion snapshot: one table per data source, and its automations named as
 * not importable. Anything else falls through: a workspace export ZIP is pages.
 */
const readNotion = (input: ImportInput): SourceRead | undefined => {
  if (input.kind !== 'snapshot') return undefined
  const [databaseId = input.stem, ...dataSourceIds] = input.manifest?.source.ids ?? []
  const read = adaptNotionSnapshot({ databaseId, dataSourceIds, files: parsedRaw(input) })
  return { tables: read, flows: [], neverImportable: read.automationsNeverImportable }
}

/** A Google Sheets snapshot: one table per sheet, or per table a sheet declares. */
const readSheets = (input: ImportInput): SourceRead => {
  if (input.kind !== 'snapshot') {
    return refuse(
      `Error: "${input.display}" is not a Google Sheets snapshot.\n\n` +
        '  A sheet downloaded from Google Sheets is an xlsx or CSV file: convert it as it is, with --from xlsx or --from csv,\n' +
        '  or fetch the spreadsheet with `sovrium import fetch sheets:<spreadsheetId>`.'
    )
  }
  return {
    tables: adaptSheetsSnapshot({ spreadsheetId: firstIdOf(input), files: parsedRaw(input) }),
  }
}

/** The tools whose zip export holds pages, handed to the page converter. */
const PAGE_TOOLS: ReadonlySet<ImportSourceTool> = new Set(['notion', 'webflow', 'retool-classic'])

/** The readers of Baserow and Retool Database, by export kind; `undefined` when none reads it. */
const readBaserowOrRetool = (
  input: ImportInput,
  tool: ImportSourceTool
): SourceRead | undefined => {
  if (tool === 'baserow' && input.exportKind === 'zip') return readBaserowZip(input)
  if (tool === 'baserow' && input.kind === 'snapshot' && input.exportKind === 'api') {
    return readBaserowSnapshot(input)
  }
  return tool === 'retool-database' && input.exportKind === 'postgres'
    ? { tables: adaptRetoolDatabaseSnapshot(parsedRaw(input)) }
    : undefined
}

/** The adapter of each tool this release converts; `undefined` falls through to pages. */
const READERS: Readonly<
  Partial<Record<ImportSourceTool, (input: ImportInput) => SourceRead | undefined>>
> = {
  csv: (input) => ({ tables: readGrid(input, 'csv') }),
  xlsx: (input) => ({ tables: readGrid(input, 'xlsx') }),
  n8n: readN8n,
  make: (input) => ({ flows: readMake(input) }),
  zapier: readZapier,
  'retool-workflows': readRetoolWorkflow,
  airtable: readAirtable,
  notion: readNotion,
  'google-sheets': readSheets,
  baserow: (input) => readBaserowOrRetool(input, 'baserow'),
  'retool-database': (input) => readBaserowOrRetool(input, 'retool-database'),
  'zapier-tables': readZapierTables,
  zite: readZite,
  webflow: readWebflow,
  'retool-classic': refuseUnreadRetoolExport,
  typeform: (input) => readForm(input, adaptTypeformSnapshot),
  tally: (input) => readForm(input, adaptTallySnapshot),
  fillout: (input) => readForm(input, adaptFilloutSnapshot),
  jotform: readJotform,
  'google-forms': (input) => readForm(input, adaptGoogleFormsSnapshot),
  'microsoft-forms': readMicrosoftForms,
}

/** Read the input through its tool's adapter. */
export const readSource = (input: ImportInput, tool: ImportSourceTool): SourceRead => {
  const read = READERS[tool]?.(input)
  if (read !== undefined) return read
  if (PAGE_TOOLS.has(tool) && input.exportKind === 'zip') return { pages: true }
  return refuse(
    `Error: "${input.display}" is a ${tool} ${input.kind === 'snapshot' ? 'snapshot' : 'export'}, ` +
      'which this release does not convert yet.\n\n' +
      '  Check `sovrium docs cli-import` for the sources this binary reads.'
  )
}
