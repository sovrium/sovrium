/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StateManager, StateManagerLive } from './state-manager'

const program = Effect.gen(function* () {
  // Parse file argument from command line
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='))
  if (!fileArg) {
    console.error('Error: --file argument is required')
    process.exit(1)
  }

  const file = fileArg.split('=')[1]

  const stateManager = yield* StateManager

  yield* Console.log(`🔒 Locking file: ${file}`)
  yield* stateManager.addActiveFile(file)
  yield* Console.log(`✅ File locked successfully`)
}).pipe(Effect.provide(StateManagerLive))

Effect.runPromise(program).catch((error) => {
  console.error('Failed to lock file:', error)
  process.exit(1)
})
