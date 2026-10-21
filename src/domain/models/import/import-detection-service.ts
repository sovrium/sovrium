/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which tool an export file came from, from its shape — the rule
 * `design-system import` set: `--from` wins; otherwise every detector that
 * matches is returned, and the caller refuses zero matches or more than one
 * rather than guessing.
 *
 * Each detector reads only what the probe holds: the extension, the parsed
 * JSON document, or the entry names of a ZIP. A snapshot written by `fetch`
 * needs no detection: its manifest names the tool.
 */

import { isWebflowCollectionHeader, isZapierTablesHeader } from './csv-export-adapter-service'
import { isFilloutForm } from './fillout-adapter-service'
import { isMakeBlueprint } from './make-adapter-service'
import { isN8nExport } from './n8n-adapter-service'
import { isRetoolWorkflowExport } from './retool-workflow-adapter-service'
import { isTallyForm } from './tally-adapter-service'
import { isTypeformForm } from './typeform-adapter-service'
import { isZapierExport } from './zapier-adapter-service'
import type { ImportSourceTool } from './import-source'

/** What detection may look at. */
export interface ImportProbe {
  /** The file extension, lower-case, with its dot (`.csv`). */
  readonly extension: string
  /** The parsed document, for a `.json` file that parses. */
  readonly json?: unknown
  /** The entry names, for a `.zip` file that opens. */
  readonly zipEntries?: readonly string[]
  /** The header row, for a `.csv` file. */
  readonly csvHeader?: readonly string[]
}

type Detector = (probe: ImportProbe) => boolean

/**
 * A Baserow workspace export holds `manifest.json` and `manifest_signature.json`
 * at its root, beside one `<application type>__<uuid hex>_<sha256>.json` per
 * application.
 */
const BASEROW_APPLICATION = /^[a-z_]+__[0-9a-f]{32}_[0-9a-f]{64}\.json$/

const isBaserowExport = (entries: readonly string[]): boolean =>
  entries.includes('manifest.json') &&
  entries.includes('manifest_signature.json') &&
  entries.some((name) => BASEROW_APPLICATION.test(name))

/** A Notion export names each page `<title> <32 hex>` (`.html` or `.md`). */
const NOTION_ENTRY = /(?:^|\/)[^/]+ [0-9a-f]{32}(?:\.(?:html|md|csv))?$/

/** The `Zapfile.json` of Zapier's "Export my data" ZIP. */
export const ZAPFILE_ENTRY = /(?:^|\/)Zapfile\.json$/i

/** A CSV whose header is a tool's own: that tool's export, not a plain CSV. */
const isToolCsv = (probe: ImportProbe): 'zapier-tables' | 'webflow' | undefined => {
  if (probe.extension !== '.csv' || probe.csvHeader === undefined) return undefined
  if (isZapierTablesHeader(probe.csvHeader)) return 'zapier-tables'
  return isWebflowCollectionHeader(probe.csvHeader) ? 'webflow' : undefined
}

const DETECTORS: readonly (readonly [ImportSourceTool, Detector])[] = [
  ['csv', (probe) => probe.extension === '.csv' && isToolCsv(probe) === undefined],
  ['zapier-tables', (probe) => isToolCsv(probe) === 'zapier-tables'],
  ['xlsx', (probe) => probe.extension === '.xlsx'],
  ['n8n', (probe) => probe.json !== undefined && isN8nExport(probe.json)],
  ['make', (probe) => probe.json !== undefined && isMakeBlueprint(probe.json)],
  [
    'zapier',
    (probe) =>
      (probe.json !== undefined && isZapierExport(probe.json)) ||
      (probe.zipEntries ?? []).some((name) => ZAPFILE_ENTRY.test(name)),
  ],
  ['retool-workflows', (probe) => probe.json !== undefined && isRetoolWorkflowExport(probe.json)],
  ['typeform', (probe) => probe.json !== undefined && isTypeformForm(probe.json)],
  ['tally', (probe) => probe.json !== undefined && isTallyForm(probe.json)],
  ['fillout', (probe) => probe.json !== undefined && isFilloutForm(probe.json)],
  ['notion', (probe) => (probe.zipEntries ?? []).some((name) => NOTION_ENTRY.test(name))],
  ['baserow', (probe) => isBaserowExport(probe.zipEntries ?? [])],
  [
    'webflow',
    (probe) =>
      isToolCsv(probe) === 'webflow' ||
      (probe.zipEntries ?? []).some((name) => /(?:^|\/)css\/[^/]+\.webflow\.css$/.test(name)),
  ],
]

/** Every tool whose detector matches the probe, in detector order. */
export const detectImportTools = (probe: ImportProbe): readonly ImportSourceTool[] =>
  DETECTORS.flatMap(([tool, detect]) => (detect(probe) ? [tool] : []))
