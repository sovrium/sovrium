/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StateManager, StateManagerLive } from './state-manager'

const program = Effect.gen(function* () {
  // Parse file argument from command line (supports both --file=value and --file value)
  let file: string | undefined

  const fileArgWithEquals = process.argv.find((arg) => arg.startsWith('--file='))
  if (fileArgWithEquals) {
    file = fileArgWithEquals.split('=')[1]
  } else {
    const fileIndex = process.argv.indexOf('--file')
    if (fileIndex !== -1 && process.argv[fileIndex + 1]) {
      file = process.argv[fileIndex + 1]
    }
  }

  if (!file) {
    console.error('Error: --file argument is required')
    process.exit(1)
  }

  const stateManager = yield* StateManager

  yield* Console.log(`🔓 Unlocking file: ${file}`)
  yield* stateManager.removeActiveFile(file)
  yield* Console.log(`✅ File unlocked successfully`)
}).pipe(Effect.provide(StateManagerLive))

Effect.runPromise(program).catch((error) => {
  console.error('Failed to unlock file:', error)
  process.exit(1)
})
