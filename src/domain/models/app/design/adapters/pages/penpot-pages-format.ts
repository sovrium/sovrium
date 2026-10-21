/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The vocabulary both halves of the Penpot page adapter share
 * (`penpot-pages-export.ts`, `penpot-pages-parse.ts`): where the file sits in
 * the bundle, what the archive holds, and how a Sovrium node is tagged on a
 * Penpot shape.
 *
 * ─── THE ARCHIVE (Penpot 2.18.3, binfile v3) ───────────────────────────────
 *
 * A `.penpot` file is a ZIP: `manifest.json` (`penpot/export-files`, version
 * 1), `files/<file>.json`, one `files/<file>/pages/<page>.json` per page, and
 * one `files/<file>/pages/<page>/<shape>.json` per shape, every key camelCase.
 * A page's root frame is the shape whose id is all zeros. An older `.penpot`
 * is Penpot's binary v1 format, which is refused, never guessed at.
 *
 * ─── TWO FACTS READ OFF A REAL EXPORT ──────────────────────────────────────
 *
 * - A frame lists its children in `shapes` from the LAST in flow to the first:
 *   in every flex frame of the pinned sample the position along the axis falls
 *   as the list goes on (and rises for `row-reverse`).
 * - `layoutPadding` is `p1` top, `p2` right, `p3` bottom, `p4` left: the
 *   sample's frames with unequal paddings place their children so.
 *
 * ─── THE TAG ───────────────────────────────────────────────────────────────
 *
 * Every shape drawn from a node carries plugin data under the namespace
 * {@link PENPOT_PLUGIN_NAMESPACE}: a map of string to string, as Penpot's
 * schema requires. Penpot reads every key of an entry through a kebab-case
 * transform, so each key is one lower-case word, and a value that is a list or
 * a record (a placement's variables, the export stamp) travels as JSON text.
 */

import { createHash } from 'node:crypto'

/** Where the Penpot file lives inside the bundle. */
export const PENPOT_DIR = 'adapters/penpot'

/** The bundle path of an app's Penpot file. */
export const penpotFilePathOf = (app: string): string => `${PENPOT_DIR}/${app}.penpot`

/** The manifest entry every v3 archive opens with. */
export const PENPOT_MANIFEST_PATH = 'manifest.json'

/** What the manifest names itself. */
export const PENPOT_EXPORT_TYPE = 'penpot/export-files'

/** The file features the pinned sample declares, which the importer accepts. */
export const PENPOT_FILE_FEATURES = ['layout/grid', 'components/v2', 'fdata/shape-data-type']

/** The file data version of the pinned sample; Penpot migrates it forward on import. */
export const PENPOT_DATA_VERSION = 58

/** The id of every page's root frame. */
export const PENPOT_ROOT_FRAME_ID = '00000000-0000-0000-0000-000000000000'

/** The plugin data namespace a Sovrium shape is tagged under (`pluginData.sovrium`). */
export const PENPOT_PLUGIN_NAMESPACE = 'sovrium'

/** The flex directions Penpot draws, which are the tree's own. */
export const PENPOT_FLEX_DIRECTIONS: ReadonlySet<string> = new Set([
  'row',
  'row-reverse',
  'column',
  'column-reverse',
])

/** The `layoutAlignItems` values Penpot draws. */
export const PENPOT_ALIGN_ITEMS: ReadonlySet<string> = new Set([
  'start',
  'end',
  'center',
  'stretch',
])

/** The `layoutJustifyContent` values Penpot draws. */
export const PENPOT_JUSTIFY_CONTENT: ReadonlySet<string> = new Set([
  'start',
  'center',
  'end',
  'space-between',
  'space-around',
  'space-evenly',
])

/** A stable UUID from a seed: the SHA-256 of the seed, shaped as a v4 UUID. */
export const penpotUuidOf = (seed: string): string => {
  const hex = createHash('sha256').update(`sovrium:penpot:${seed}`).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

/** What the first bytes of a `.penpot` file say it is. */
export type PenpotContainer = 'zip' | 'binfile-v1' | 'unknown'

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const
const BINFILE_V1_MAGIC = [0x01, 0x0b, 0x1a, 0x86] as const

const startsWith = (bytes: Uint8Array, magic: readonly number[]): boolean =>
  bytes.length >= magic.length && magic.every((byte, index) => bytes[index] === byte)

/** Whether a `.penpot` file is a v3 ZIP, Penpot's older binary format, or neither. */
export const penpotContainerOf = (bytes: Uint8Array): PenpotContainer => {
  if (startsWith(bytes, ZIP_MAGIC)) return 'zip'
  if (startsWith(bytes, BINFILE_V1_MAGIC)) return 'binfile-v1'
  return 'unknown'
}

/** Why a `.penpot` file that is no v3 archive is refused. */
export const penpotContainerRefusal = (container: PenpotContainer): string =>
  container === 'binfile-v1'
    ? 'It is a Penpot file in the older binary format, which this version does not read. Open it in Penpot 2 and export it again: Penpot writes the current format, a ZIP archive.'
    : 'It is not a Penpot file: a Penpot export is a ZIP archive.'

/**
 * Whether an archive entry name stays inside the archive: relative, with no
 * `..` segment, no backslash and no control character. An archive holding any
 * other name is refused whole.
 */
export const isSafePenpotEntryName = (name: string): boolean =>
  name.length > 0 &&
  !name.startsWith('/') &&
  !name.includes('\\') &&
  // eslint-disable-next-line no-control-regex -- refusing control characters IS the check
  !/[\u0000-\u001f]/.test(name) &&
  !/^[A-Za-z]:/.test(name) &&
  !name.split('/').some((segment) => segment === '..' || segment === '.')
