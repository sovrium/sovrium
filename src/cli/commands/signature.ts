/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium signature verify <export> [--json]`
 *
 * Checks a signing export — the one JSON document
 * `GET /api/signatures/requests/:id/export` answers — with no server, no
 * database and no network: the file bytes against their SHA-256, the event
 * chain hash by hash, the frozen document against the fingerprint the signers
 * signed, each signing event against its signer and mark, and the seal and
 * the chain-head timestamp the export carries, their certificates judged
 * against the roots in `SIGNATURE_SEAL_CERT_CHAIN` when it is set: a seal or
 * a timestamp that verifies to a root nobody named is `untrusted`.
 *
 * Exit code 0 exactly when no check fails; 1 when one fails or the file
 * cannot be read; 2 for a command line it cannot use.
 */

import { X509Certificate } from 'node:crypto'
import { Effect } from 'effect'
import { CliExit, fromAsyncValue, type CliStop, type CommandArgs } from '@/cli/runtime/run-command'
import { decodeSafe } from '@/domain/kernel/config-parsing/decode'
import { exportManifestSchema } from '@/domain/models/api/signatures/export'
import { cryptographicCheckLines } from '@/domain/models/app/signatures/signature-export-crypto-service'
import {
  verifySignatureExport,
  type CryptographicCheckLines,
} from '@/domain/models/app/signatures/signature-export-verification-service'
import { printLine } from '@/infrastructure/logging/cli-output'
import type { VerifyReport } from '@/domain/models/api/signatures/export'

const USAGE = [
  'Usage:',
  '  sovrium signature verify <export> [--json]   Check a signing export offline',
].join('\n')

/**
 * The largest export this command reads: its files are base64 in one JSON
 * document, so a few signed contracts fit many times over, and a file past it
 * is refused before it is read rather than exhausting memory.
 */
const MAX_EXPORT_BYTES = 1024 * 1024 * 1024

/** The parsed export, or `undefined` for a file that is not JSON. */
const readExport = async (path: string): Promise<unknown> => {
  try {
    return JSON.parse(await Bun.file(path).text()) as unknown
  } catch {
    return undefined
  }
}

const CERTIFICATE_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g

/** The roots this verifier trusts: every certificate of `SIGNATURE_SEAL_CERT_CHAIN`, when set. */
const trustedRoots = (): readonly X509Certificate[] =>
  (process.env['SIGNATURE_SEAL_CERT_CHAIN']?.match(CERTIFICATE_BLOCK) ?? []).flatMap((pem) => {
    try {
      return [new X509Certificate(pem)]
    } catch {
      return []
    }
  })

/** The seal and timestamp checks of `document`, when it decodes as an export. */
const cryptographicLinesOf = async (document: unknown): Promise<CryptographicCheckLines> => {
  const decoded = decodeSafe(exportManifestSchema)(document)
  return decoded.success ? cryptographicCheckLines(decoded.data, trustedRoots()) : {}
}

/** The report as lines a person reads: one per check, then the verdict. */
const reportLines = (report: VerifyReport): readonly string[] => [
  ...report.checks.map(
    (line) =>
      `${line.check.padEnd(11)} ${line.outcome}${line.detail === undefined ? '' : `  ${line.detail}`}`
  ),
  '',
  `${report.events} events, ${report.erasures} erasures`,
  report.valid
    ? 'Valid: no check failed (each passed, is absent or is untrusted)'
    : 'Not valid: a check failed',
]

/** Handle `sovrium signature <verb>`. */
export const handleSignatureCommand = (args: CommandArgs): Effect.Effect<void, CliStop> =>
  Effect.gen(function* () {
    const path = args.positionalArg
    if (args.subcommand !== 'verify' || path === undefined || path === '') {
      return yield* new CliExit({ code: 2, stderr: USAGE })
    }
    if (!(yield* fromAsyncValue(() => Bun.file(path).exists()))) {
      return yield* new CliExit({ code: 1, stderr: `No export at ${path}` })
    }
    if (Bun.file(path).size > MAX_EXPORT_BYTES) {
      return yield* new CliExit({ code: 1, stderr: `The export at ${path} is larger than 1 GiB` })
    }
    const document = yield* fromAsyncValue(() => readExport(path))
    const lines = yield* fromAsyncValue(() => cryptographicLinesOf(document))
    const report = verifySignatureExport(document, [], lines)
    yield* Effect.sync(() =>
      args.json === true
        ? printLine(JSON.stringify(report, null, 2))
        : reportLines(report).forEach((line) => printLine(line))
    )
    if (!report.valid) return yield* new CliExit({ code: 1 })
  })
