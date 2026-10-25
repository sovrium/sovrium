/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --pages --tokens`: the colours a Claude Design
 * canvas's Theme menu changed in its own `ds/<app>/tokens.json`, read against
 * an unedited export's token file and written to the config's `design`.
 *
 * A JSON or YAML config gets each changed colour set in `design.colors` (the
 * light theme) or `design.darkColors` (the dark one), beside the page edits of
 * the same run; a YAML one on the line of that colour, which must be there. A
 * TypeScript config is reported, never written, and so is a dry run.
 */

import { parseJson } from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import {
  canvasTokenChanges,
  designColourKeyOf,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-tokens'
import { refuse } from './app-prelude'
import { patchYamlScalarsInPlace } from './design-system-import-pages-yaml'
import { rootFormatOf } from './library-add-config'
import type { LocatedPageSource } from './design-system-import-pages-source'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'

type JsonObject = Readonly<Record<string, unknown>>

/** One colour to set in the config's `design`. */
export interface ColourWrite {
  readonly key: 'colors' | 'darkColors'
  readonly token: string
  readonly value: string
}

/** What `--tokens` read: the report, and the colours to write. */
export interface TokenRead {
  readonly report: NonNullable<PageImportReport['tokens']>
  readonly writes: readonly ColourWrite[]
}

/** An unedited export's token file: its path inside the canvas, and its document. */
export interface UneditedTokens {
  readonly path: string
  readonly document: unknown
}

const decoder = new TextDecoder()

/** Why the token changes are not written, or `undefined` when they are. */
const unwrittenReason = (
  configPath: string,
  write: boolean,
  changed: boolean
): string | undefined => {
  if (!changed) return 'The canvas changed no colour token.'
  if (rootFormatOf(configPath) === 'typescript') {
    return 'A TypeScript config is never edited for tokens; set the colours in its `design` by hand.'
  }
  return write ? undefined : 'Nothing is written on a dry run.'
}

/**
 * Read the canvas token file against an unedited export's.
 *
 * @param located - the canvas, as located.
 * @param unedited - the unedited export's token file.
 * @param target - the config, and whether `--write` was asked.
 */
export const readCanvasTokens = async (
  located: Pick<LocatedPageSource, 'format' | 'view' | 'files'>,
  unedited: UneditedTokens,
  target: { readonly configPath: string; readonly write: boolean }
): Promise<TokenRead> => {
  if (located.format !== 'claude-design') {
    return refuse('Error: --tokens reads a Claude Design canvas only; this drawing is not one.')
  }
  const [folder = ''] = located.files
  const bytes = await located.view.read(
    folder === '' ? unedited.path : `${folder}/${unedited.path}`
  )
  if (bytes === undefined) {
    return refuse(`Error: --tokens found no ${unedited.path} in the canvas.`)
  }
  const changes = canvasTokenChanges(parseJson(decoder.decode(bytes)), unedited.document)
  const reason = unwrittenReason(target.configPath, target.write, changes.length > 0)
  return {
    report: { changes, written: reason === undefined, ...(reason === undefined ? {} : { reason }) },
    writes:
      reason === undefined
        ? changes.flatMap((change) => {
            const key = designColourKeyOf(change.theme)
            return key === undefined ? [] : [{ key, token: change.token, value: change.after }]
          })
        : [],
  }
}

const objectAt = (value: unknown, key: string): JsonObject => {
  const child = (value as JsonObject | undefined)?.[key]
  return typeof child === 'object' && child !== null ? (child as JsonObject) : {}
}

/** A config root with each colour set in its `design`. */
export const withColours = (root: JsonObject, writes: readonly ColourWrite[]): JsonObject => {
  if (writes.length === 0) return root
  const design = writes.reduce<JsonObject>(
    (acc, write) => ({
      ...acc,
      [write.key]: { ...objectAt(acc, write.key), [write.token]: write.value },
    }),
    objectAt(root, 'design')
  )
  return { ...root, design }
}

/** Whether a config root holds each colour as written. */
export const holdsColours = (root: unknown, writes: readonly ColourWrite[]): boolean =>
  writes.every(
    (write) => objectAt(objectAt(root, 'design'), write.key)[write.token] === write.value
  )

/**
 * A config's text with its colours set: a JSON one re-laid out as it was, a
 * YAML one on the line of each colour; `undefined` when a YAML colour has no
 * line of its own.
 *
 * @param text - the config file.
 * @param format - its format.
 * @param writes - the colours to set.
 */
export const patchColours = (
  text: string,
  format: 'yaml' | 'json',
  writes: readonly ColourWrite[]
): string | undefined => {
  if (writes.length === 0) return text
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  if (format === 'yaml') {
    const lines = patchYamlScalarsInPlace(
      text.split(eol),
      writes.map((write) => ({ path: ['design', write.key, write.token], value: write.value }))
    )
    return lines?.join(eol)
  }
  const indent = /\n( +|\t)"/.exec(text)?.[1] ?? '  '
  const body = JSON.stringify(
    withColours(JSON.parse(text) as JsonObject, writes),
    undefined,
    indent
  )
  return `${eol === '\n' ? body : body.replaceAll('\n', eol)}${text.endsWith('\n') ? eol : ''}`
}
