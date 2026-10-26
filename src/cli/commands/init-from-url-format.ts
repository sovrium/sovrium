/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the format of a document fetched by `sovrium init --from-url` comes from.
 *
 * The extension of the URL's PATH decides, never the whole URL: a query string
 * is the host's business (a signature, a download name, a cache buster) and
 * says nothing about the bytes, so it is sent exactly as given and ignored
 * here. When the path carries no extension, the response's `Content-Type`
 * decides. When neither names YAML or JSON the fork is refused — after the
 * fetch, still before the first write — because the format is what decides
 * whether it lands as `app.yaml` or `app.json`.
 */

import { detectFormatFromContentType } from '@/domain/kernel/config-parsing/format-detection'
import { stripSigningFromUrl } from '@/domain/kernel/url/signed-url-stripping'
import { printStderr } from '@/infrastructure/logging/cli-output'

/** The two formats a forked config can land in. */
export type ForkFormat = 'json' | 'yaml'

/** What a URL's path says before the fetch. Both are absent when it names no format. */
export interface ForkTarget {
  readonly format?: ForkFormat
  readonly filename?: string
}

/** The project filename a fork of each format is written as. */
export const forkFilenameFor = (format: ForkFormat): string =>
  format === 'json' ? 'app.json' : 'app.yaml'

/**
 * Settle the format of a fetched document: the path's extension first, then
 * the response's `Content-Type`, else refuse (exit 1) naming both ways out —
 * and the address without its signature, which is a credential.
 */
export const settleForkFormat = (
  pathFormat: ForkFormat | undefined,
  response: Response,
  rawUrl: string
): ForkFormat => {
  if (pathFormat !== undefined) return pathFormat
  const contentType = response.headers.get('content-type') ?? ''
  const typed = detectFormatFromContentType(contentType)
  if (typed === 'json' || typed === 'yaml') return typed
  printStderr(
    `Error: Could not tell whether the config at ${stripSigningFromUrl(rawUrl).url} is YAML or JSON, so nothing was created.\n` +
      `Its path does not end in .yaml, .yml or .json, and its Content-Type ` +
      `(${contentType === '' ? 'none' : `"${contentType}"`}) names neither.\n` +
      `The format decides whether the fork lands as app.yaml or app.json. Use a URL whose path\n` +
      `ends in .yaml, .yml or .json, or serve the document as application/yaml or application/json.`
  )
  return process.exit(1)
}
