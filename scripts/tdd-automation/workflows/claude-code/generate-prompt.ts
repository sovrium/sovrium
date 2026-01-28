#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate Agent Prompt CLI Entry Point
 *
 * CLI script called by claude-code.yml workflow to generate agent invocation prompts.
 * Reads context from environment variables and outputs prompt to stdout.
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/claude-code/generate-prompt.ts
 *
 * Environment Variables:
 *   agent-type, spec-id, spec-file, has-conflict, conflict-files
 *
 * Output (Markdown):
 *   Complete agent prompt markdown written to stdout
 */

import { Effect, Console } from 'effect'
import { generateAgentPrompt, parseAgentPromptContext } from '../../services/agent-prompt-generator'

const main = Effect.gen(function* () {
  // Parse context from environment variables (GitHub Actions outputs)
  const context = yield* parseAgentPromptContext(process.env as Record<string, string>)

  // Generate agent prompt
  const prompt = yield* generateAgentPrompt(context)

  // Output prompt to stdout (will be written to file by YAML)
  yield* Console.log(prompt)
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::Failed to generate agent prompt: ${error}`)
      return yield* Effect.fail(error)
    })
  )
)

Effect.runPromise(main)
