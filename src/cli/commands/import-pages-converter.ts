/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page converter `sovrium import` calls through the `MigratedPages` port
 * ([internal ref] A14, pages part): it opens the page export a snapshot holds, within
 * limits, and hands its files to the source's pure converter.
 *
 * Each page source is one row of `PAGE_SOURCES`: a Notion workspace or page
 * export becomes new pages through `planNotionPages`, a Webflow code export
 * through `planWebflowPages`, and a Retool classic ToolScript ZIP through
 * `planRetoolClassicPages`. A source with no row reports its pages as
 * `pending`.
 *
 * ─── OPENING THE ZIP ───────────────────────────────────────────────────────
 *
 * The archive is the user's, so it is read with the bounded reader user ZIPs
 * go through (`readOoxmlPackage`): the directory is checked against an entry
 * count, a total inflated size and a per-entry ratio before anything is
 * inflated. Every entry name is then checked BEFORE it is used: an absolute
 * path, a `..` segment, a backslash, a drive letter or a control character
 * refuses the whole export — a page export never needs one, and a path that
 * climbs out of the archive is how a ZIP writes where it should not. Nothing
 * is written here; nothing in the archive is run.
 *
 * Notion may wrap a large export in a ZIP of ZIPs (fact a9 describes the
 * workspace export, not its wrapping); a ZIP holding only ZIPs is opened one
 * level down, the limits counting every part together.
 */

import { Layer } from 'effect'
import {
  MigratedPages,
  PENDING_PAGES_REPORT,
  type MigratedPagesConverter,
  type MigratedPagesPlan,
  type MigratedPagesTarget,
  type MigrationSnapshot,
} from '@/application/ports/services/migrated-pages'
import {
  readOoxmlPackage,
  type OoxmlPackageLimits,
} from '@/application/use-cases/automations/ooxml/ooxml-package'
import {
  planNotionPages,
  type MigrationTarget,
} from '@/domain/models/app/design/adapters/pages/migrate/notion-pages-migrate'
import { planRetoolClassicPages } from '@/domain/models/app/design/adapters/pages/migrate/retool-classic-pages-migrate'
import { planWebflowPages } from '@/domain/models/app/design/adapters/pages/migrate/webflow-pages-migrate'
import { refuse } from './app-prelude'
import type { NotionExportEntry } from '@/domain/models/app/design/adapters/pages/migrate/notion-pages-parse'

/** What the config already holds: its pages, and the spacing scale layout is written on. */
type PageTarget = MigrationTarget & MigratedPagesTarget

/** The limits a page export is opened within. A workspace export carries every image it shows. */
export const PAGE_EXPORT_LIMITS: OoxmlPackageLimits = {
  maxEntries: 20_000,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 200,
  ratioFloorBytes: 1024 * 1024,
}

/** The export's files, or why it cannot be opened. */
export type PageExportRead =
  | { readonly ok: true; readonly entries: readonly NotionExportEntry[] }
  | { readonly ok: false; readonly reason: string }

/**
 * Whether an entry name stays inside the archive: relative, no `..` segment,
 * no backslash, no drive letter, no control character.
 */
export const isSafeExportEntryName = (name: string): boolean =>
  name !== '' &&
  !name.startsWith('/') &&
  !name.includes('\\') &&
  !/^[a-z]:/i.test(name) &&
  ![...name].some((char) => (char.codePointAt(0) ?? 0) < 0x20 || char === '\x7f') &&
  !name.split('/').includes('..')

const isZipName = (name: string): boolean => name.toLowerCase().endsWith('.zip')

/** Open one archive: its file entries (folders dropped), every name checked. */
const openArchive = (bytes: Uint8Array, limits: OoxmlPackageLimits): PageExportRead => {
  const read = readOoxmlPackage(bytes, limits)
  if (!read.ok) return { ok: false, reason: read.message }
  const unsafe = read.entries.find((entry) => !isSafeExportEntryName(entry.name))
  if (unsafe !== undefined) {
    return {
      ok: false,
      reason: `holds an entry named ${JSON.stringify(unsafe.name)}, a path that leaves the archive`,
    }
  }
  return {
    ok: true,
    entries: read.entries
      .filter((entry) => !entry.name.endsWith('/'))
      .map((entry) => ({ path: entry.name, bytes: entry.bytes })),
  }
}

/**
 * Open a page export ZIP, and the ZIPs it wraps when it holds nothing else.
 *
 * The parts are opened one after another, each within what the parts before
 * it left of the limits, so the limits bound what is inflated altogether:
 * checking the sum only once every part was open would let a few small parts
 * each inflate to the whole limit first.
 */
export const openPageExport = (
  bytes: Uint8Array,
  limits: OoxmlPackageLimits = PAGE_EXPORT_LIMITS
): PageExportRead => {
  const outer = openArchive(bytes, limits)
  if (!outer.ok || outer.entries.length === 0) return outer
  if (!outer.entries.every((entry) => isZipName(entry.path))) return outer
  const parts: (readonly NotionExportEntry[])[] = []
  let spentEntries = 0
  let spentBytes = 0
  for (const part of outer.entries) {
    const read = openArchive(part.bytes, {
      ...limits,
      maxEntries: limits.maxEntries - spentEntries,
      maxTotalUncompressedBytes: limits.maxTotalUncompressedBytes - spentBytes,
    })
    if (!read.ok) return read
    parts[parts.length] = read.entries
    spentEntries += read.entries.length
    spentBytes += read.entries.reduce((sum, entry) => sum + entry.bytes.length, 0)
  }
  return { ok: true, entries: parts.flat() }
}

/** The page export a snapshot holds: its first `raw/` ZIP, by path. */
const exportZipOf = (snapshot: MigrationSnapshot): Uint8Array | undefined => {
  const [entry] = [...snapshot.raw.entries()]
    .filter(([path]) => isZipName(path))
    .toSorted(([a], [b]) => a.localeCompare(b))
  return entry?.[1]
}

/** One page source's pure converter, over the files of its opened export. */
interface PageSource {
  /** The export, as a refusal names it. */
  readonly label: string
  readonly plan: (
    entries: readonly NotionExportEntry[],
    target: PageTarget
  ) =>
    | { readonly ok: true; readonly plan: MigratedPagesPlan }
    | { readonly ok: false; readonly reason: string }
}

/**
 * The page sources this binary converts, by the tool `sovrium import` names.
 * A source without a row here reports its pages as pending; another source's
 * parser plugs in as one more row.
 */
const PAGE_SOURCES: Readonly<Partial<Record<string, PageSource>>> = {
  notion: {
    label: 'a Notion export',
    plan: (entries, target) => {
      const planned = planNotionPages(entries, target)
      // Notion's export carries no form a page could hold (fact a4: a form view
      // cannot be exported), so a Notion migration emits no form.
      return planned.ok
        ? { ok: true, plan: { pages: planned.pages, report: planned.report, forms: [] } }
        : planned
    },
  },
  'retool-classic': {
    label: 'a Retool classic ToolScript ZIP',
    plan: (entries, target) => {
      const planned = planRetoolClassicPages(entries, target)
      // A Retool form posts to a query, so it stays an unbound form node and no
      // extracted form is made for it.
      return planned.ok
        ? { ok: true, plan: { pages: planned.pages, report: planned.report, forms: [] } }
        : planned
    },
  },
  webflow: {
    label: 'a Webflow site export',
    // The export's forms go to the forms mapper; layout is written on the config's own scale.
    plan: (entries, target) => {
      const planned = planWebflowPages(entries, { spacing: target.spacing })
      return planned.ok
        ? { ok: true, plan: { pages: planned.pages, report: planned.report, forms: planned.forms } }
        : planned
    },
  },
}

/** The converter's answer, or the refusal a CLI prints. */
export type PageConversion =
  | { readonly ok: true; readonly plan: MigratedPagesPlan }
  | { readonly ok: false; readonly message: string }

/**
 * Convert the pages of a snapshot into a config already holding `target`.
 * Never throws and never exits: a refusal is returned with its message.
 */
export const convertMigratedPages = (
  snapshot: MigrationSnapshot,
  target: PageTarget = {}
): PageConversion => {
  const source = Object.hasOwn(PAGE_SOURCES, snapshot.manifest.tool)
    ? PAGE_SOURCES[snapshot.manifest.tool]
    : undefined
  if (source === undefined) {
    return { ok: true, plan: { pages: [], report: PENDING_PAGES_REPORT, forms: [] } }
  }
  const display = snapshot.manifest.source.uri
  const refusal = (reason: string): PageConversion => ({
    ok: false,
    message: `Error: "${display}" cannot be read as ${source.label}: it ${reason}.`,
  })
  const zip = exportZipOf(snapshot)
  if (zip === undefined) return refusal('holds no export ZIP')
  const opened = openPageExport(zip)
  if (!opened.ok) return refusal(opened.reason)
  const planned = source.plan(opened.entries, target)
  return planned.ok ? { ok: true, plan: planned.plan } : refusal(planned.reason)
}

/**
 * The port's converter: the plan, or the refusal printed and the process
 * ended with exit code 1, before anything is written. `target` is what the
 * config already holds; without it, no page is refused on its name or path,
 * and no layout value is on a step.
 */
export const planMigratedPages = (
  snapshot: MigrationSnapshot,
  target?: PageTarget
): MigratedPagesPlan => {
  const converted = convertMigratedPages(snapshot, target)
  return converted.ok ? converted.plan : refuse(converted.message)
}

const CONVERTER: MigratedPagesConverter = { planMigratedPages }

/**
 * The Layer that installs the page converter: `sovrium import` provides it to
 * the program that reads `MigratedPages`.
 *
 * @public Awaiting the import's call site, which reads the port's default today.
 */
export const MigratedPagesLive = Layer.succeed(MigratedPages, CONVERTER)
