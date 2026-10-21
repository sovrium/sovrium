/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — the page exports the import refuses, and the line each
 * refusal prints. Airtable Interfaces wait for a file export. A Retool classic
 * app is read only from the ToolScript ZIP: its JSON app export, and an export
 * from before ToolScript, are refused by their format — no self-hosted version
 * is checked, the format is the gate. Every refusal here happens before
 * anything is written.
 */

import { readZipDirectory } from '@/application/use-cases/automations/action-handlers/file-zip-read'
import { refuse } from './app-prelude'
import { firstRaw, type ImportInput } from './import-input'

/** The `--from` value an operator may try for Airtable Interfaces, which is no source yet. */
export const AIRTABLE_INTERFACES = 'airtable-interfaces'

/** `--from airtable-interfaces`: deferred until Airtable offers a file export. */
export const refuseAirtableInterfaces = (): never =>
  refuse(
    `Error: --from ${AIRTABLE_INTERFACES}: Airtable Interfaces have no file export, so they cannot be imported yet.\n\n` +
      "  An Interface's tables and records import with --from airtable; its pages wait until Airtable can export one."
  )

const RETOOL_TOOLSCRIPT =
  'Export the app as the ToolScript ZIP that Retool Cloud, or a self-hosted Retool at 3.6.0 or later, writes, and import that ZIP.'

/** A Retool classic JSON app export, which is never read: Retool does not document its structure. */
const refuseRetoolJsonExport = (input: ImportInput): never =>
  refuse(
    `Error: "${input.display}" is a Retool JSON app export, which the import never reads: Retool does not document its structure.\n\n` +
      `  ${RETOOL_TOOLSCRIPT}`
  )

/** A Retool classic ZIP with no `main.rsx`: an export from before ToolScript. */
const refusePreToolScriptExport = (input: ImportInput): never =>
  refuse(
    `Error: "${input.display}" is not a ToolScript ZIP: it holds no main.rsx, so it is a Retool export from before ToolScript, which the import does not read.\n\n` +
      `  ${RETOOL_TOOLSCRIPT}\n` +
      '  Retool Database and Retool Workflows import as they did: --from retool-database, --from retool-workflows.'
  )

/** The root file of a ToolScript app, at the top of the ZIP or one folder down. */
const TOOLSCRIPT_MAIN = /^(?:[^/]+\/)?main\.rsx$/

/**
 * A Retool classic input the import does not read is refused: its JSON app
 * export, and a ZIP holding no `main.rsx`. Anything else gives `undefined`, so
 * a ToolScript ZIP falls through to the page converter.
 */
export const refuseUnreadRetoolExport = (input: ImportInput): undefined => {
  if (input.exportKind === 'json') return refuseRetoolJsonExport(input)
  if (input.exportKind !== 'zip') return undefined
  const directory = readZipDirectory(firstRaw(input)?.bytes ?? new Uint8Array()) ?? []
  return directory.some((entry) => TOOLSCRIPT_MAIN.test(entry.name))
    ? undefined
    : refusePreToolScriptExport(input)
}
