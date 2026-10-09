/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether the local storage directory sits on a disk that ignores letter case.
 *
 * Measured, never inferred from the platform: a case-sensitive APFS volume, or
 * a Linux host writing to a mounted case-insensitive share, would be misjudged
 * by `process.platform`. The probe writes one file whose name holds both cases
 * and looks for it under its lower-case spelling.
 */

import { randomUUID } from 'node:crypto'
import { rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Write a mixed-case probe file into `directory` and report whether its
 * lower-case spelling finds it. The probe is removed before this settles.
 * Rejects when the directory cannot be written.
 */
export const probeCaseInsensitiveDirectory = async (directory: string): Promise<boolean> => {
  const name = `.sovrium-case-probe-${randomUUID()}-Aa`
  const probe = join(directory, name)
  await writeFile(probe, '')
  try {
    return await stat(join(directory, name.toLowerCase())).then(
      () => true,
      () => false
    )
  } finally {
    await rm(probe, { force: true })
  }
}

/** The outcome of one probe: the measured answer, or the cause it could not be measured. */
export interface LocalCaseProbeResult {
  readonly caseInsensitive: boolean
  /** Present only when the probe failed; the answer is then `true` (see below). */
  readonly cause?: unknown
}

/** Settled-or-in-flight probes, one per directory, for the life of the process. */
const probes = new Map<string, Promise<LocalCaseProbeResult>>()

/**
 * Probe `directory` once per process. A disk does not change case rules under a
 * running server, and the storage layer may be built more than once.
 *
 * Never rejects. A probe that fails answers `caseInsensitive: true`: comparing
 * keys without case only refuses more second spellings, while wrongly comparing
 * with case would let one replace a stored file.
 *
 * @param probe - The measurement, injected so a unit test can drive a failure.
 */
export const probeLocalCaseOnce = (
  directory: string,
  probe: (directory: string) => Promise<boolean> = probeCaseInsensitiveDirectory
): Promise<LocalCaseProbeResult> => {
  const cached = probes.get(directory)
  if (cached !== undefined) return cached
  const result = probe(directory).then(
    (caseInsensitive): LocalCaseProbeResult => ({ caseInsensitive }),
    (cause: unknown): LocalCaseProbeResult => ({ caseInsensitive: true, cause })
  )
  probes.set(directory, result)
  return result
}
