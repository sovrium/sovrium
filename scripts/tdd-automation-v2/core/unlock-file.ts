/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StateManager, StateManagerLive } from './state-manager'
import { Command, Args } from '@effect/cli'

const UnlockFileCommand = Command.make(
  'unlock-file',
  {
    file: Args.text({ name: 'file' }),
  },
  ({ file }) =>
    Effect.gen(function* () {
      const stateManager = yield* StateManager

      yield* Console.log(`🔓 Unlocking file: ${file}`)
      yield* stateManager.removeActiveFile(file)
      yield* Console.log(`✅ File unlocked successfully`)
    })
)

const program = UnlockFileCommand.pipe(Effect.provide(StateManagerLive))

Effect.runPromise(program).catch((error) => {
  console.error('Failed to unlock file:', error)
  process.exit(1)
})
