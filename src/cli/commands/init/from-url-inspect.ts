/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `--from-url` road's checks that write nothing: the flags it refuses
 * beside it, and `--inspect`.
 *
 * `sovrium init --from-url <url> --inspect` runs every check a fork runs — the
 * scheme, a remote `.ts`, a bundle's address, the size cap, a remote `$ref`,
 * the decode — and then prints the report `--from-bundle --inspect` prints
 * (`inspection.ts`) instead of writing a project. A shell shows it on its
 * consent screen, then forks with `--expect-sha256` pinned to the `sha256` it
 * showed, so the bytes approved are the bytes written even if the publisher
 * changes the document in between. Nothing is downloaded to keep: `file` is
 * `null`, and the pinned fork fetches the document again.
 */

import { assertNotABundleUrl } from '@/cli/commands/init/from-bundle-source'
import {
  assertForkableUrl,
  fetchForkedConfig,
  type ForkedConfig,
} from '@/cli/commands/init/from-url'
import { printInspection } from '@/cli/commands/init/inspection'
import { refuseCommand, stopCommand } from '@/cli/runtime/run-command'
import type { ForkFormat } from '@/cli/commands/init/from-url-format'

/** A sha256 in hex, as `--expect-sha256` takes it. */
const SHA256_HEX = /^[0-9a-f]{64}$/i

const fail = (message: string): never => stopCommand(1, `Error: ${message}`)

/**
 * Refuse `--from-url` alongside a flag that would decide the same file.
 *
 * `--template` ships its own config and `--typescript` generates one, so
 * either would have to be silently discarded for the fork to land. Refusing is
 * the only answer that does not throw away half of what was asked for.
 */
export const assertFromUrlAlone = (
  fromUrl: string | undefined,
  templateName: string | undefined,
  typescript: boolean
): void => {
  if (fromUrl === undefined) return
  const conflicting = templateName !== undefined ? '--template' : typescript ? '--typescript' : ''
  if (conflicting === '') return
  return refuseCommand({
    headline: `Cannot combine --from-url with ${conflicting}.`,
    detail: [
      'Both decide what the project config is, and only one of them can win —',
      'so honouring either would mean silently discarding the other.',
    ],
    guidance: `Pick one: fork the published config with --from-url, or scaffold with ${conflicting}.`,
  })
}

/**
 * Fetch and check the document as {@link fetchForkedConfig} does, then hold it
 * to `--expect-sha256` when one was given. The pin is checked before the first
 * write, so a document the publisher changed after it was inspected forks
 * nothing; a malformed pin is refused before anything is fetched.
 */
export const fetchPinnedConfig = async (
  fromUrl: string,
  format: ForkFormat | undefined,
  expectSha256: string | undefined
): Promise<ForkedConfig> => {
  if (expectSha256 !== undefined && !SHA256_HEX.test(expectSha256)) {
    return fail(
      `--expect-sha256 takes a sha256 in hex (64 characters), and "${expectSha256}" is not one.`
    )
  }
  const forked = await fetchForkedConfig(fromUrl, format)
  const expected = expectSha256?.toLowerCase()
  if (expected !== undefined && forked.sha256 !== expected) {
    return fail(
      `The document's sha256 is ${forked.sha256}, and --expect-sha256 names ${expected}. ` +
        'These are not the bytes that were approved, so nothing was written.'
    )
  }
  return forked
}

/** What `init` hands over to {@link inspectFromUrl}. */
export interface InspectFromUrlOptions {
  readonly fromUrl: string
  readonly expectSha256?: string | undefined
  readonly templateName?: string | undefined
  readonly typescript?: boolean | undefined
}

/**
 * `--from-url <url> --inspect`: refuse the flags a fork would refuse, fetch and
 * judge the document, print one JSON report on stdout, write nothing. Every
 * refusal exits 1 with the reason the fork would give.
 */
export const inspectFromUrl = async (options: InspectFromUrlOptions): Promise<void> => {
  const { fromUrl } = options
  assertFromUrlAlone(fromUrl, options.templateName, options.typescript === true)
  const target = assertForkableUrl(assertNotABundleUrl(fromUrl))
  const forked = await fetchPinnedConfig(fromUrl, target.format, options.expectSha256)
  await printInspection({
    host: forked.host,
    name: forked.name,
    size: Buffer.byteLength(forked.content, 'utf-8'),
    sha256: forked.sha256,
    verdict: 'unverified',
    containsDemoData: false,
    containsCode: forked.code.steps,
    file: null,
  })
}
