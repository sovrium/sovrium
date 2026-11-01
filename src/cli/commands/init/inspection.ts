/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one report `sovrium init --inspect` prints, whichever road it inspects.
 *
 * `--from-bundle` and `--from-url` both let a shell show a person what a
 * project contains before anything is written, then fork it with
 * `--expect-sha256` pinned to what was shown. The shell reads ONE shape for
 * both, so the shape lives here and nowhere else: same keys, same order, one
 * JSON object on one line.
 *
 * - `host` — where the bytes finally came from (after redirects), `null` for a local file.
 * - `verdict` — the publisher verdict. A published document carries no
 *   signature, so it is always `unverified`.
 * - `containsCode` — each automation step that runs code (`codeStepsOf`), `[]` when none.
 * - `file` — the downloaded archive kept for the confirmation; `null` when
 *   nothing was kept (a document is re-fetched and pinned by its sha256).
 */

import { writeStdout } from '@/cli/commands/document-output'
import type { CodeStep } from '@/domain/models/app/automations/code-steps-service'

/** What an inspection established about the bytes it judged. */
export interface InspectionReport {
  readonly host: string | null
  readonly name: string
  readonly size: number
  readonly sha256: string
  readonly verdict: string
  readonly containsDemoData: boolean
  readonly containsCode: readonly CodeStep[]
  readonly file: string | null
}

/**
 * The report as the single line `--inspect` prints on stdout.
 *
 * Built key by key rather than serialising the argument, so the order is
 * fixed and a caller passing a wider object cannot leak an extra field.
 */
export const inspectionLine = (report: InspectionReport): string =>
  `${JSON.stringify({
    host: report.host,
    name: report.name,
    size: report.size,
    sha256: report.sha256,
    verdict: report.verdict,
    containsDemoData: report.containsDemoData,
    containsCode: report.containsCode.map(({ automation, step }) => ({ automation, step })),
    file: report.file,
  })}\n`

/** Print {@link inspectionLine} — the only thing `--inspect` writes to stdout. */
export const printInspection = (report: InspectionReport): Promise<void> =>
  writeStdout(inspectionLine(report))
