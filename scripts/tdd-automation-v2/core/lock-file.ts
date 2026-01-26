/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StateManager, StateManagerLive } from './state-manager'
import { Command, Args } from '@effect/cli'

const LockFileCommand = Command.make(
  'lock-file',
  {
    file: Args.text({ name: 'file' }),
  },
  ({ file }) =>
    Effect.gen(function* () {
      const stateManager = yield* StateManager

      yield* Console.log(`🔒 Locking file: ${file}`)
      yield* stateManager.addActiveFile(file)
      yield* Console.log(`✅ File locked successfully`)
    })
)

const program = LockFileCommand.pipe(Effect.provide(StateManagerLive))

Effect.runPromise(program).catch((error) => {
  console.error('Failed to lock file:', error)
  process.exit(1)
})
