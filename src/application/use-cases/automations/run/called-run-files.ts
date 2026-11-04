/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The files an `automation/call` hands across: a called run is part of its
 * caller's chain, so the temporary files its caller wrote are its own too, and
 * a synchronous call hands the ones it writes back once it returns.
 *
 * Only the written-files ledger crosses (`run-written-files.ts`). A called run
 * still starts with nothing read, so a file its caller only READ stays out of
 * its reach, and a file another run wrote stays out of reach of both. The
 * called run works on its own copy, never on its caller's ledger: an
 * asynchronous call, which its caller does not wait for, hands nothing back.
 */

import { UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { createParkedStepCell } from '../action-handlers/parked-step-files'
import {
  createRunWrittenFiles,
  type RunWrittenEntry,
  type RunWrittenFiles,
} from '../action-handlers/run-written-files'
import type { RunLedgers } from './run-ledger-persistence'

/** What a called run starts with, and what its caller held when it called. */
export interface CalledRunLedgers {
  readonly ledgers: RunLedgers
  readonly inherited: readonly RunWrittenEntry[]
}

/**
 * The ledgers a called run starts with: a copy of the files its caller wrote,
 * nothing read, and no paused step.
 */
export const calledRunLedgers = (caller: RunWrittenFiles | undefined): CalledRunLedgers => {
  const inherited = caller?.entries() ?? []
  return {
    inherited,
    ledgers: {
      writtenFiles: createRunWrittenFiles(inherited),
      readFiles: createRunWrittenFiles(),
      parkedStep: createParkedStepCell(),
    },
  }
}

/**
 * Hand a synchronous call's written files back to its caller: every file the
 * called run holds when it returns, with the standing it gave it, and none of
 * the caller's files the called run deleted or moved away.
 */
export const handBackWrittenFiles = (
  caller: RunWrittenFiles | undefined,
  called: CalledRunLedgers
): void => {
  if (caller === undefined) return
  const held = called.ledgers.writtenFiles.entries()
  const kept = new Set(held.map((entry) => entry.key))
  called.inherited
    .filter((entry) => !kept.has(entry.key))
    .forEach((entry) => caller.forget(entry.key))
  held.forEach((entry) =>
    caller.record(entry.bucket ?? UNATTRIBUTED_BUCKET, entry.key, {
      carriesRunBytes: entry.carriesRunBytes,
    })
  )
}
