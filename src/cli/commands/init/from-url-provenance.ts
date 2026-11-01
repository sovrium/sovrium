/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium init --from-url` WRITES DOWN about the document it forked.
 *
 * The fetch uses the URL exactly as given: a presigned link without its
 * signature is a `403`. What is recorded is another matter. The sidecar is
 * meant to be committed, and a signed link is a credential until it expires,
 * so `source` is the URL with its signing parameters taken out
 * (`stripSigningFromUrl`) and `"signedSource": true` says the recorded address
 * is not the whole one. An unsigned fork's sidecar carries no `signedSource`
 * at all, so it is byte-for-byte what it always was.
 *
 * The same rule decides what a refusal prints: {@link printableUrl}.
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stripSigningFromUrl } from '@/domain/kernel/url/signed-url-stripping'

/** The provenance sidecar written beside a forked config. */
export const PROVENANCE_FILENAME = '.sovrium-template.json'

/** A forked document, as far as its record needs it. */
export interface ForkedRecord {
  /** The URL it was fetched from, AS GIVEN. Stripped here, never upstream. */
  readonly source: string
  readonly filename: string
  readonly content: string
  readonly sha256: string
}

/** A URL as a terminal or log line may show it: never its signature. */
export const printableUrl = (rawUrl: string): string => stripSigningFromUrl(rawUrl).url

/** The sidecar's JSON object. `signedSource` is ABSENT, not `false`, when unsigned. */
export const provenanceRecord = (
  forked: ForkedRecord,
  fetchedAt: string
): Readonly<Record<string, unknown>> => {
  const { url, signed } = stripSigningFromUrl(forked.source)
  return {
    source: url,
    ...(signed ? { signedSource: true } : {}),
    sha256: forked.sha256,
    file: forked.filename,
    fetchedAt,
  }
}

/**
 * Write the forked config verbatim, plus the provenance sidecar.
 *
 * BYTE-FOR-BYTE, never re-serialised through a YAML writer. An AI is about to
 * edit this file, and the comments explaining it are most of what makes that
 * possible — a round-trip through a serialiser strips every one of them and
 * reorders the keys for good measure.
 *
 * Provenance goes in a sidecar rather than a header comment: a comment does not
 * survive the first rewrite, and a JSON config cannot carry one at all. The
 * file is meant to be committed — it is also what lets a shell offer "reset to
 * the template I started from".
 *
 * @public
 */
export const writeForkedConfig = async (
  forked: ForkedRecord,
  targetDir: string
): Promise<readonly string[]> => {
  const configPath = join(targetDir, forked.filename)
  await writeFile(configPath, forked.content)

  const provenancePath = join(targetDir, PROVENANCE_FILENAME)
  const record = provenanceRecord(forked, new Date().toISOString())
  await writeFile(provenancePath, `${JSON.stringify(record, undefined, 2)}\n`)

  return [configPath, provenancePath]
}
