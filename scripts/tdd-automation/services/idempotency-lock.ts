/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Idempotency Lock Service
 *
 * Prevents concurrent populate operations from creating duplicate issues
 */

import * as Effect from 'effect/Effect'
import { CommandService, FileSystemService, logInfo, logWarn, logError } from '../../lib/effect'

const LOCK_FILE_PATH = '.github/tdd-queue-populate.lock'
const STALE_LOCK_MINUTES = 30

/**
 * Check idempotency lock to prevent concurrent populate runs
 * Returns true if safe to proceed, false if another populate is in progress
 */
export const checkIdempotencyLock = Effect.gen(function* () {
  const fs = yield* FileSystemService
  const cmd = yield* CommandService

  // Check if lock file exists
  const lockExists = yield* fs.exists(LOCK_FILE_PATH)

  if (!lockExists) {
    return true // No lock, safe to proceed
  }

  // Read lock file to check timestamp
  const lockContent = yield* fs
    .readFile(LOCK_FILE_PATH)
    .pipe(Effect.catchAll(() => Effect.succeed('')))

  if (!lockContent) {
    return true // Empty lock, safe to proceed
  }

  try {
    const lockData = JSON.parse(lockContent) as { timestamp: string; pid?: string }
    const lockTime = new Date(lockData.timestamp)
    const now = new Date()
    const ageMinutes = (now.getTime() - lockTime.getTime()) / 1000 / 60

    // If lock is older than 30 minutes, consider it stale
    if (ageMinutes > STALE_LOCK_MINUTES) {
      yield* logWarn(`⚠️  Stale lock file detected (${Math.round(ageMinutes)} minutes old)`)
      yield* logInfo('Removing stale lock and proceeding')
      yield* cmd.exec(`rm -f ${LOCK_FILE_PATH}`).pipe(Effect.catchAll(() => Effect.void))
      return true
    }

    // Lock is recent, another populate is likely in progress
    yield* logError('❌ Another populate operation is in progress')
    yield* logError(`   Started: ${lockData.timestamp} (${Math.round(ageMinutes)} minutes ago)`)
    yield* logError('   Please wait for it to complete or remove .github/tdd-queue-populate.lock')
    return false
  } catch {
    // Corrupted lock file, remove it
    yield* logWarn('⚠️  Corrupted lock file detected, removing')
    yield* cmd.exec(`rm -f ${LOCK_FILE_PATH}`).pipe(Effect.catchAll(() => Effect.void))
    return true
  }
})

/**
 * Create idempotency lock file
 */
export const createIdempotencyLock = Effect.gen(function* () {
  const fs = yield* FileSystemService

  const lockData = {
    timestamp: new Date().toISOString(),
    pid: process.pid.toString(),
  }

  yield* fs.writeFile(LOCK_FILE_PATH, JSON.stringify(lockData, null, 2))
  yield* logInfo(`🔒 Created idempotency lock: ${LOCK_FILE_PATH}`)
})

/**
 * Remove idempotency lock file
 */
export const removeIdempotencyLock = Effect.gen(function* () {
  const cmd = yield* CommandService

  yield* cmd.exec(`rm -f ${LOCK_FILE_PATH}`).pipe(Effect.catchAll(() => Effect.void))
  yield* logInfo(`🔓 Removed idempotency lock`)
})
