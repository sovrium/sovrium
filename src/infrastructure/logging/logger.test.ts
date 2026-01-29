/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from 'bun:test'
import { Effect } from 'effect'
import { Logger, LoggerLive, LoggerSilent, logError, logInfo, logWarning } from './logger'

test('Logger service - info logs message', async () => {
  const program = Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.info('Test info message')
  })

  // Should complete without errors
  await Effect.runPromise(program.pipe(Effect.provide(LoggerLive)))
})

test('Logger service - error logs with cause', async () => {
  const program = Effect.gen(function* () {
    const logger = yield* Logger
    const error = new Error('Test error')
    yield* logger.error('Test error message', error)
  })

  // Should complete without errors
  await Effect.runPromise(program.pipe(Effect.provide(LoggerLive)))
})

test('Logger service - warn logs message', async () => {
  const program = Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.warn('Test warning message')
  })

  // Should complete without errors
  await Effect.runPromise(program.pipe(Effect.provide(LoggerLive)))
})

test('LoggerSilent discards all messages', async () => {
  const program = Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.info('This should be silent')
    yield* logger.error('This should also be silent')
  })

  // Should complete without errors and no output
  await Effect.runPromise(program.pipe(Effect.provide(LoggerSilent)))
})

test('Convenience functions work outside Effect context', () => {
  // These should execute synchronously without errors
  logInfo('Convenience info')
  logWarning('Convenience warning')
  logError('Convenience error', new Error('Test'))
})
