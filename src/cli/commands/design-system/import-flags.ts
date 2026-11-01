/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The flags `sovrium design-system import` reads, and the token import's
 * request read from them.
 */

import { refuse } from '@/cli/commands/app-prelude'
import { defineFlags, flag, type FlagsOf } from '@/cli/runtime/flag-schema'
import {
  IMPORT_FORMATS,
  type ImportFormat,
} from '@/domain/models/app/design/adapters/import/canonical-tokens-service'

/** The flags `sovrium design-system import` reads, with and without `--pages`. */
export const designSystemImportFlags = defineFlags({
  write: flag.switch('--write'),
  dryRun: flag.switch('--dry-run'),
  config: flag.value('--config'),
  from: flag.value('--from'),
  json: flag.switch('--json'),
  pages: flag.switch('--pages'),
  page: flag.switch('--page'),
  pageNames: flag.values('--page'),
  tokens: flag.switch('--tokens'),
  newPages: flag.switch('--new-pages'),
  sidecar: flag.switch('--sidecar'),
})

/** {@link designSystemImportFlags}, read. */
export type DesignSystemImportFlags = FlagsOf<typeof designSystemImportFlags>

/** The request, as read from the flags. */
export interface ImportRequest {
  readonly source: string
  readonly config: string | undefined
  readonly from: ImportFormat | undefined
  readonly write: boolean
  readonly json: boolean
}

const USAGE =
  'Usage:\n  sovrium design-system import <file|folder> --config <app.yaml|app.json|app.ts> ' +
  '[--from <format>] [--dry-run | --write] [--json]'

/** Read the request off the flags (`design-system import <path> …`). */
export const readRequest = (
  flags: DesignSystemImportFlags,
  positional: readonly string[]
): ImportRequest => {
  const source = positional[1]
  if (source === undefined) return refuse(`Error: No token file or folder given.\n\n${USAGE}`)
  const { write } = flags
  if (write && flags.dryRun) {
    return refuse('Error: --write and --dry-run contradict each other. Choose one.')
  }
  return {
    source,
    config: flags.config,
    from: readFrom(flags.from),
    write,
    json: flags.json,
  }
}

export const FORMAT_LIST = IMPORT_FORMATS.join(', ')

const readFrom = (raw: string | undefined): ImportFormat | undefined => {
  if (raw === undefined) return undefined
  const format = IMPORT_FORMATS.find((candidate) => candidate === raw.trim().toLowerCase())
  return (
    format ?? refuse(`Error: Unsupported --from "${raw}".\n\n  Accepted formats: ${FORMAT_LIST}.`)
  )
}
